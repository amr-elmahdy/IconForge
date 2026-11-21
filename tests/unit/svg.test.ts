import { describe, expect, it } from 'vitest';
import { analyzeSvg } from '../../src/processors/svg/analyzer.js';
import { optimizeSvg } from '../../src/processors/svg/optimizer.js';
import { processSvg } from '../../src/processors/svg/process.js';
import { parseSvg } from '../../src/processors/svg/xml.js';
import { validateSvgText } from '../../src/validators/svg-validator.js';
import { sha256 } from '../../src/utils/hashing.js';
import { fixture } from '../helpers.js';

const opts = { optimize: false, maxFileBytes: 1_000_000 };

describe('SVG processing', () => {
  it('processes a valid SVG: adds xmlns, drops comments/declaration, keeps visuals and colors', async () => {
    const out = await processSvg(await fixture('valid.svg'), opts);
    expect(out.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">')).toBe(true);
    expect(out.svg).not.toContain('<!--');
    expect(out.svg).not.toContain('<?xml');
    expect(out.svg).toContain('fill="url(#g)"');
    expect(out.analysis.viewBox).toBe('0 0 24 24');
    expect(out.analysis.colors).toEqual(['#aabbcc', '#ff0000', '#ffffff']);
    expect(out.analysis.usesCurrentColor).toBe(false);
    expect(out.sha256).toBe(sha256(out.svg));
    expect(validateSvgText(out.svg).ok).toBe(true);
  });
  it('is idempotent', async () => {
    const a = await processSvg(await fixture('valid.svg'), opts);
    const b = await processSvg(a.svg, opts);
    expect(b.svg).toBe(a.svg);
  });
  it('rejects malformed XML with a structured error', async () => {
    await expect(processSvg(await fixture('broken.svg'), opts)).rejects.toMatchObject({ code: 'SVG_PARSE_ERROR', stage: 'parse' });
  });
  it('rejects non-SVG roots and files with no shapes', async () => {
    await expect(processSvg('<html xmlns="x"><body/></html>', opts)).rejects.toMatchObject({ code: 'SVG_FORBIDDEN_ELEMENT' });
    await expect(processSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><g/></svg>', opts)).rejects.toMatchObject({ code: 'SVG_INVALID' });
  });
  it('removes scripts and event handlers non-silently, keeps the shape', async () => {
    const out = await processSvg(await fixture('evil-script.svg'), opts);
    expect(out.svg).not.toContain('script');
    expect(out.svg).not.toContain('onclick');
    expect(out.svg).toContain('<rect');
    expect(out.notes).toEqual(expect.arrayContaining(['removed <script> element', 'removed event handler onclick on <rect>']));
  });
  it('rejects foreignObject and external references instead of silently destroying content', async () => {
    await expect(processSvg(await fixture('foreign-object.svg'), opts)).rejects.toMatchObject({ code: 'SVG_FORBIDDEN_ELEMENT' });
    await expect(processSvg(await fixture('external-ref.svg'), opts)).rejects.toMatchObject({ code: 'SVG_EXTERNAL_REFERENCE' });
    await expect(processSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0" style="fill:url(https://x.test/a)"/></svg>', opts)).rejects.toMatchObject({ code: 'SVG_EXTERNAL_REFERENCE' });
    await expect(processSvg('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1 1"><a xlink:href="javascript:alert(1)"><path d="M0 0"/></a></svg>', opts)).rejects.toMatchObject({ code: 'SVG_JS_URL' });
  });
  it('refuses entity declarations (XXE / entity bombs)', async () => {
    const xxe = '<!DOCTYPE svg [<!ENTITY a "boom">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0"/></svg>';
    await expect(processSvg(xxe, opts)).rejects.toMatchObject({ code: 'SVG_PARSE_ERROR' });
  });
  it('does not touch colors, viewBox or add default fill/stroke', async () => {
    const src = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 16"><path d="M1 1h2" /></svg>';
    const out = await processSvg(src, opts);
    expect(out.svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 16"><path d="M1 1h2"/></svg>\n');
  });
  it('detects currentColor usage and does not report it as a color', () => {
    const a = analyzeSvg(parseSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0" fill="currentColor" stroke="none"/></svg>').root);
    expect(a.usesCurrentColor).toBe(true);
    expect(a.colors).toEqual([]);
  });
  it('keeps the unoptimized SVG when the optimizer breaks the visual structure', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0"/><circle r="1"/></svg>\n';
    const res = await optimizeSvg(svg, () => ({ data: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0"/></svg>' }));
    expect(res.optimized).toBe(false);
    expect(res.svg).toBe(svg);
    expect(res.warning).toContain('visual structure');
  });
  it('keeps the unoptimized SVG when the optimizer throws, and accepts a safe optimization', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0"/></svg>\n';
    const bad = await optimizeSvg(svg, () => { throw new Error('boom'); });
    expect(bad.optimized).toBe(false);
    const good = await optimizeSvg(svg, (s) => ({ data: s.trim() }));
    expect(good.optimized).toBe(true);
  });
});
