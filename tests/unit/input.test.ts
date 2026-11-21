import { describe, expect, it } from 'vitest';
import { parseInputText } from '../../src/input/reader.js';
import { discoverIcons, resolveName } from '../../src/sources/thesvg/discovery.js';
import { parseRegistry } from '../../src/sources/thesvg/repository.js';
import { fixture } from '../helpers.js';

describe('input file', () => {
  it('reads names, ignores comments/blank lines/extra spaces and keeps line numbers', () => {
    const e = parseInputText('# Languages\n\n  react  \r\n\t# note\ngithub\n');
    expect(e).toEqual([{ line: 3, name: 'react' }, { line: 5, name: 'github' }]);
  });
  it('detects duplicates (by slug and by alias) with line numbers', async () => {
    const { index } = parseRegistry(await fixture('registry.json'));
    const r = discoverIcons(index, parseInputText('react\ngithub\nReact\nreactjs\n'));
    expect(r.resolved.map((x) => x.entry.slug)).toEqual(['react', 'github']);
    expect(r.duplicates).toBe(2);
    expect(r.warnings[0]?.message).toContain('Line 3');
  });
  it('reports unknown slugs with the line number and suggestions', async () => {
    const { index } = parseRegistry(await fixture('registry.json'));
    const r = discoverIcons(index, parseInputText('react\nreac\ngit'));
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]?.code).toBe('ICON_NOT_FOUND');
    expect(r.errors[0]?.message).toContain('Line 2');
    expect(r.errors[1]?.message).toContain('github');
  });
  it('resolves slug first, then unique alias; ambiguous aliases are refused', async () => {
    const { index } = parseRegistry(await fixture('registry.json'));
    const a = resolveName(index, 'reactjs');
    expect(a.ok && a.matchedBy).toBe('alias');
    const s = resolveName(index, 'FOO');
    expect(s.ok && s.entry.slug).toBe('foo');
    const amb = resolveName(index, 'shared');
    expect(amb.ok).toBe(false);
    expect(!amb.ok && amb.code).toBe('ALIAS_AMBIGUOUS');
  });
  it('discovers the real variants per icon without assuming any', async () => {
    const { index } = parseRegistry(await fixture('registry.json'));
    expect(index.getBySlug('react')?.variants).toEqual(['default', 'mono', 'wordmarkLight']);
    expect(index.getBySlug('foo-mono')?.variants).toEqual(['default']);
  });
});
