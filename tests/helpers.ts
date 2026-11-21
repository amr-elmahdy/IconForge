import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/core/config.js';
import { createContext, type ForgeContext } from '../src/core/context.js';
import { createSilentLogger } from '../src/core/logger.js';
import type { IconCliOptions } from '../src/core/types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const fixture = (name: string): Promise<string> => readFile(path.join(here, 'fixtures', name), 'utf8');

export async function tmpProject(inputText: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'iconforge-'));
  await mkdir(path.join(dir, 'input'), { recursive: true });
  await writeFile(path.join(dir, 'input', 'icons.txt'), inputText);
  return dir;
}

export async function makeCtx(cwd: string, fetchImpl: typeof fetch, over: Partial<IconCliOptions> = {}): Promise<ForgeContext> {
  const config = await loadConfig(cwd);
  config.network.retries = 2;
  config.network.retryBaseDelayMs = 0;
  config.source.commitApiUrl = null;
  return createContext({ config, logger: createSilentLogger(), fetchImpl, options: { verbose: false, dryRun: false, force: false, optimize: false, input: null, cwd, ...over } });
}

export interface MockServer {
  fetch: typeof fetch;
  calls: string[];
  /** url substring -> handler; first match wins */
  routes: Array<{ match: string; respond: () => Response | Promise<Response> }>;
}

export function mockServer(registry: string, svgs: Record<string, string>): MockServer {
  const calls: string[] = [];
  const server: MockServer = {
    calls,
    routes: [],
    fetch: (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      for (const r of server.routes) if (url.includes(r.match)) return r.respond();
      if (url.endsWith('/api/registry.json')) return new Response(registry, { status: 200 });
      const m = /\/icons\/([^/]+)\/([^/]+)\.svg$/.exec(url);
      if (m) {
        const body = svgs[`${m[1]}/${m[2]}`];
        if (body !== undefined) return new Response(body, { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch,
  };
  return server;
}
