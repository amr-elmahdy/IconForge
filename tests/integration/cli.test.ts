import { describe, expect, it } from 'vitest';
import { parseArgs, runCli } from '../../src/cli/index.js';
import { createSilentLogger } from '../../src/core/logger.js';
import { fixture, mockServer, tmpProject } from '../helpers.js';

describe('CLI', () => {
  it('parses commands and options', () => {
    const p = parseArgs(['build', '--dry-run', '--force', '--no-optimize', '--verbose', '--input', 'x.txt']);
    expect(p.command).toBe('build');
    expect(p.options).toEqual({ dryRun: true, force: true, optimize: false, verbose: true, input: 'x.txt' });
    expect(parseArgs(['build', '--input=y.txt']).options.input).toBe('y.txt');
    expect(parseArgs([]).command).toBe('help');
  });
  it('rejects unknown commands/options with exit code 3', async () => {
    const cwd = await tmpProject('react\n');
    expect(await runCli(['frobnicate'], { cwd, logger: createSilentLogger() })).toBe(3);
    expect(await runCli(['build', '--nope'], { cwd, logger: createSilentLogger() })).toBe(3);
    expect(await runCli(['help'], { cwd, logger: createSilentLogger() })).toBe(0);
  });
  it('build -> validate -> info -> clean-cache end to end', async () => {
    const cwd = await tmpProject('react\n');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h1v1z"/></svg>';
    const server = mockServer(await fixture('registry.json'), { 'react/default': svg, 'react/mono': svg, 'react/wordmarkLight': svg });
    const env = { cwd, fetchImpl: server.fetch, logger: createSilentLogger(), buildDeps: undefined };
    expect(await runCli(['build', '--no-optimize'], env)).toBe(0);
    expect(await runCli(['validate'], env)).toBe(0);
    expect(await runCli(['info'], env)).toBe(0);
    expect(await runCli(['clean-cache'], env)).toBe(0);
  });
});
