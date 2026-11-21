import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runBuild } from '../../src/pipeline/pipeline.js';
import { validateOutput } from '../../src/validators/output-validator.js';
import { fixture, makeCtx, mockServer, tmpProject } from '../helpers.js';

const GOOD = (n: number): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h${n}v${n}z" fill="#123456"/></svg>`;
const svgs = {
  'react/default': GOOD(1), 'react/mono': GOOD(2), 'react/wordmarkLight': GOOD(3),
  'github/default': GOOD(4), 'github/mono': GOOD(5),
};

const iconFiles = async (cwd: string): Promise<string[]> => (await readdir(path.join(cwd, 'output/icons'))).sort();
const runDirs = async (cwd: string): Promise<string[]> => (await readdir(path.join(cwd, 'reports/runs'))).sort();

describe('build pipeline (mock HTTP, no external network)', () => {
  it('builds a flat icons folder, metadata, manifest and a report with all five files', async () => {
    const cwd = await tmpProject('# langs\nreact\ngithub\n');
    const server = mockServer(await fixture('registry.json'), svgs);
    const res = await runBuild(await makeCtx(cwd, server.fetch));
    expect(res.exitCode).toBe(0);
    expect(await iconFiles(cwd)).toEqual(['github-mono.svg', 'github.svg', 'react-mono.svg', 'react-wordmark-light.svg', 'react.svg']);
    const v = await validateOutput({ iconsDir: path.join(cwd, 'output/icons'), iconsJson: path.join(cwd, 'output/metadata/icons.json'), manifestJson: path.join(cwd, 'output/metadata/manifest.json') });
    expect(v.ok).toBe(true);
    expect(v.checkedFiles).toBe(5);
    const [run] = await runDirs(cwd);
    expect((await readdir(path.join(cwd, 'reports/runs', run!))).sort()).toEqual(['changes.json', 'errors.json', 'report.json', 'summary.md', 'validation.json']);
    expect(await readFile(path.join(cwd, 'reports/runs', run!, 'summary.md'), 'utf8')).toContain('Icons requested: 2');
  });

  it('creates a new report every run and never rewrites earlier ones', async () => {
    const cwd = await tmpProject('react\n');
    const server = mockServer(await fixture('registry.json'), svgs);
    const first = await runBuild(await makeCtx(cwd, server.fetch));
    const before = await readFile(path.join(first.runDir, 'report.json'), 'utf8');
    const second = await runBuild(await makeCtx(cwd, server.fetch));
    const third = await runBuild(await makeCtx(cwd, server.fetch));
    expect(new Set([first.runId, second.runId, third.runId]).size).toBe(3);
    expect(await runDirs(cwd)).toHaveLength(3);
    expect(await readFile(path.join(first.runDir, 'report.json'), 'utf8')).toBe(before);
  });

  it('skips unchanged files on the next run (no icon downloads) and keeps metadata stable', async () => {
    const cwd = await tmpProject('react\n');
    const server = mockServer(await fixture('registry.json'), svgs);
    await runBuild(await makeCtx(cwd, server.fetch));
    const iconsJson1 = await readFile(path.join(cwd, 'output/metadata/icons.json'), 'utf8');
    server.calls.length = 0;
    const res = await runBuild(await makeCtx(cwd, server.fetch));
    expect(server.calls.filter((u) => u.includes('/icons/'))).toEqual([]);
    expect(res.report.files.every((f) => f.status === 'unchanged')).toBe(true);
    expect(await readFile(path.join(cwd, 'output/metadata/icons.json'), 'utf8')).toBe(iconsJson1);
    expect(res.report.metadataWritten).toBe(false);
  });

  it('--force re-downloads everything', async () => {
    const cwd = await tmpProject('react\n');
    const server = mockServer(await fixture('registry.json'), svgs);
    await runBuild(await makeCtx(cwd, server.fetch));
    server.calls.length = 0;
    await runBuild(await makeCtx(cwd, server.fetch, { force: true }));
    expect(server.calls.filter((u) => u.includes('/icons/'))).toHaveLength(3);
  });

  it('dry-run writes nothing to output/ or cache/ but still creates a report', async () => {
    const cwd = await tmpProject('react\n');
    const server = mockServer(await fixture('registry.json'), svgs);
    const res = await runBuild(await makeCtx(cwd, server.fetch, { dryRun: true }));
    await expect(readdir(path.join(cwd, 'output'))).rejects.toThrow();
    await expect(readdir(path.join(cwd, 'cache'))).rejects.toThrow();
    expect(res.report.files.every((f) => f.status === 'new')).toBe(true);
    expect(await runDirs(cwd)).toHaveLength(1);
  });

  it('reports unknown names (with line numbers) but still builds the rest; exit code 1', async () => {
    const cwd = await tmpProject('react\nnope\n');
    const server = mockServer(await fixture('registry.json'), svgs);
    const res = await runBuild(await makeCtx(cwd, server.fetch));
    expect(res.exitCode).toBe(1);
    expect(res.report.errors[0]?.message).toContain('Line 2');
    expect(await iconFiles(cwd)).toContain('react.svg');
  });

  it('does not overwrite a healthy file when a later update fails', async () => {
    const cwd = await tmpProject('github\n');
    const reg1 = await fixture('registry.json');
    await runBuild(await makeCtx(cwd, mockServer(reg1, svgs).fetch));
    const good = await readFile(path.join(cwd, 'output/icons/github.svg'), 'utf8');
    const meta = await readFile(path.join(cwd, 'output/metadata/icons.json'), 'utf8');
    // source entry changed (new license) -> reprocess needed, but the new SVG is broken
    const reg2 = reg1.replace('"hex":"181717"', '"hex":"000000"');
    const res = await runBuild(await makeCtx(cwd, mockServer(reg2, { ...svgs, 'github/default': '<svg><path d="M0 0"></svg>' }).fetch, { force: true }));
    expect(res.exitCode).toBe(1);
    expect(res.report.errors.some((e) => e.icon === 'github' && e.variant === 'default' && e.code === 'SVG_PARSE_ERROR')).toBe(true);
    expect(await readFile(path.join(cwd, 'output/icons/github.svg'), 'utf8')).toBe(good);
    const after = JSON.parse(await readFile(path.join(cwd, 'output/metadata/icons.json'), 'utf8')) as { icons: Array<{ slug: string; variant: string; brandColorHex: string | null }> };
    expect(after.icons.find((i) => i.variant === 'default')?.brandColorHex).toBe('181717');
    expect(JSON.parse(meta).icons).toHaveLength(2);
  });

  it('retries transient errors (503, 429) and then succeeds', async () => {
    const cwd = await tmpProject('github\n');
    const server = mockServer(await fixture('registry.json'), svgs);
    let hits = 0;
    server.routes.push({ match: '/icons/github/default.svg', respond: () => (++hits === 1 ? new Response('busy', { status: 503 }) : hits === 2 ? new Response('slow down', { status: 429, headers: { 'retry-after': '0' } }) : new Response(GOOD(4), { status: 200 })) });
    const res = await runBuild(await makeCtx(cwd, server.fetch));
    expect(hits).toBe(3);
    expect(res.exitCode).toBe(0);
  });

  it('records structured errors for persistent HTTP failures and network exceptions, without aborting the run', async () => {
    const cwd = await tmpProject('react\ngithub\n');
    const server = mockServer(await fixture('registry.json'), svgs);
    server.routes.push({ match: '/icons/github/default.svg', respond: () => new Response('err', { status: 500 }) });
    server.routes.push({ match: '/icons/github/mono.svg', respond: () => { throw new TypeError('fetch failed'); } });
    const res = await runBuild(await makeCtx(cwd, server.fetch));
    expect(res.exitCode).toBe(1);
    const errs = res.report.errors.filter((e) => e.icon === 'github');
    expect(errs.map((e) => e.variant).sort()).toEqual(['default', 'mono']);
    expect(errs.every((e) => e.stage === 'download' && e.recoverable)).toBe(true);
    expect(await iconFiles(cwd)).toContain('react.svg');
    const errorsJson = JSON.parse(await readFile(path.join(res.runDir, 'errors.json'), 'utf8')) as { errors: unknown[] };
    expect(errorsJson.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to the cached registry when the network is down (warning, exit 2)', async () => {
    const cwd = await tmpProject('react\n');
    await runBuild(await makeCtx(cwd, mockServer(await fixture('registry.json'), svgs).fetch));
    const down = (async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
    const res = await runBuild(await makeCtx(cwd, down));
    expect(res.fatal).toBe(false);
    expect(res.exitCode).toBe(2);
    expect(res.report.warnings.some((w) => w.code === 'REGISTRY_WARNING')).toBe(true);
  });

  it('fails fatally (exit 3, report still written) with no registry and no cache', async () => {
    const cwd = await tmpProject('react\n');
    const down = (async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
    const res = await runBuild(await makeCtx(cwd, down));
    expect(res.fatal).toBe(true);
    expect(res.exitCode).toBe(3);
    expect(await runDirs(cwd)).toHaveLength(1);
  });

  it('keeps local files for variants that disappeared from the source and reports them as stale', async () => {
    const cwd = await tmpProject('github\n');
    const reg1 = await fixture('registry.json');
    await runBuild(await makeCtx(cwd, mockServer(reg1, svgs).fetch));
    const reg2 = reg1.replace('"variants":["default","mono"]},\n {"slug":"foo"', '"variants":["default"]},\n {"slug":"foo"');
    const res = await runBuild(await makeCtx(cwd, mockServer(reg2, svgs).fetch));
    expect(res.report.staleVariants).toEqual([{ slug: 'github', variant: 'mono', filename: 'github-mono.svg' }]);
    expect(await iconFiles(cwd)).toContain('github-mono.svg');
  });

  it('does not touch icons outside the requested set', async () => {
    const cwd = await tmpProject('react\n');
    const server = mockServer(await fixture('registry.json'), svgs);
    await runBuild(await makeCtx(cwd, server.fetch));
    await writeFile(path.join(cwd, 'input/icons.txt'), 'github\n');
    await runBuild(await makeCtx(cwd, server.fetch));
    expect(await iconFiles(cwd)).toEqual(['github-mono.svg', 'github.svg', 'react-mono.svg', 'react-wordmark-light.svg', 'react.svg']);
    const manifest = JSON.parse(await readFile(path.join(cwd, 'output/metadata/manifest.json'), 'utf8')) as { counts: { icons: number } };
    expect(manifest.counts.icons).toBe(2);
  });

  it('reports filename collisions instead of overwriting', async () => {
    const cwd = await tmpProject('foo\nfoo-mono\n');
    const server = mockServer(await fixture('registry.json'), { 'foo/default': GOOD(1), 'foo/mono': GOOD(2), 'foo-mono/default': GOOD(3) });
    const res = await runBuild(await makeCtx(cwd, server.fetch));
    expect(res.report.errors.some((e) => e.code === 'FILENAME_COLLISION' && e.icon === 'foo-mono')).toBe(true);
    expect(await readFile(path.join(cwd, 'output/icons/foo-mono.svg'), 'utf8')).toContain('h2v2z');
  });

  it('never leaves temp files behind', async () => {
    const cwd = await tmpProject('react\n');
    await runBuild(await makeCtx(cwd, mockServer(await fixture('registry.json'), svgs).fetch));
    expect((await iconFiles(cwd)).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    await mkdir(path.join(cwd, 'x'), { recursive: true });
  });
});
