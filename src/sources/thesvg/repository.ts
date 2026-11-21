import path from 'node:path';
import { ForgeError, NetworkError } from '../../core/errors.js';
import type { ForgeContext } from '../../core/context.js';
import { sha256 } from '../../utils/hashing.js';
import { atomicWrite, readJsonIfExists, readTextIfExists } from '../../utils/filesystem.js';
import { createHttpClient, type HttpClient } from './client.js';
import { RegistryEntrySchema, RegistrySchema, type RegistryEntry, type SourceRevision } from './types.js';

export class RegistryIndex {
  private readonly bySlug = new Map<string, RegistryEntry>();
  private readonly byAlias = new Map<string, string[]>();
  readonly skipped: number;

  constructor(entries: RegistryEntry[], skipped = 0) {
    this.skipped = skipped;
    for (const e of entries) {
      this.bySlug.set(e.slug.toLowerCase(), e);
      for (const alias of e.aliases ?? []) {
        const key = alias.trim().toLowerCase();
        if (!key) continue;
        const list = this.byAlias.get(key) ?? [];
        if (!list.includes(e.slug)) list.push(e.slug);
        this.byAlias.set(key, list);
      }
    }
  }

  get size(): number {
    return this.bySlug.size;
  }
  getBySlug(slug: string): RegistryEntry | undefined {
    return this.bySlug.get(slug.toLowerCase());
  }
  /** Slugs whose aliases equal `name` (case-insensitive). More than one result means the alias is ambiguous. */
  findByAlias(name: string): string[] {
    return this.byAlias.get(name.trim().toLowerCase()) ?? [];
  }
  suggest(name: string, limit = 3): string[] {
    const q = name.toLowerCase();
    const out: string[] = [];
    for (const slug of this.bySlug.keys()) {
      if (slug.includes(q) || (q.length >= 4 && q.includes(slug))) out.push(slug);
      if (out.length >= limit) break;
    }
    return out;
  }
}

export function parseRegistry(text: string): { index: RegistryIndex; total: number; skipped: number } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new ForgeError({ code: 'REGISTRY_INVALID_JSON', stage: 'registry', message: `Registry is not valid JSON: ${(err as Error).message}`, recoverable: false });
  }
  const top = RegistrySchema.safeParse(json);
  if (!top.success) {
    throw new ForgeError({ code: 'REGISTRY_SHAPE', stage: 'registry', message: 'Registry has unexpected shape (expected { icons: [...] }).', recoverable: false });
  }
  const entries: RegistryEntry[] = [];
  let skipped = 0;
  for (const raw of top.data.icons) {
    const r = RegistryEntrySchema.safeParse(raw);
    if (r.success) entries.push(r.data);
    else skipped++;
  }
  if (entries.length === 0) {
    throw new ForgeError({ code: 'REGISTRY_EMPTY', stage: 'registry', message: 'Registry contains no usable icon entries.', recoverable: false });
  }
  return { index: new RegistryIndex(entries, skipped), total: entries.length, skipped };
}

export interface LoadedRegistry {
  index: RegistryIndex;
  revision: SourceRevision;
  warnings: string[];
}

/** Loads the registry from the network (updating the cache) or, if the network fails, from the cached copy. */
export async function loadRegistry(ctx: ForgeContext, http?: HttpClient): Promise<LoadedRegistry> {
  const client = http ?? createHttpClient(ctx.fetchImpl, ctx.config.network);
  const cacheFile = path.join(ctx.paths.cacheDir, 'registry.json');
  const metaFile = path.join(ctx.paths.cacheDir, 'registry.meta.json');
  const warnings: string[] = [];

  let text: string | null = null;
  let fromCache = false;
  let fetchedAt = new Date().toISOString();
  try {
    text = await client.getText(ctx.config.source.registryUrl);
    parseRegistry(text); // validate before it can replace the cache
    if (!ctx.options.dryRun) {
      await atomicWrite(cacheFile, text);
      await atomicWrite(metaFile, JSON.stringify({ fetchedAt }, null, 2) + '\n');
    }
  } catch (err) {
    const cached = await readTextIfExists(cacheFile);
    if (cached === null) {
      if (err instanceof ForgeError) throw err;
      throw new ForgeError({ code: 'REGISTRY_UNAVAILABLE', stage: 'registry', message: `Cannot load registry: ${(err as Error).message}`, recoverable: false, cause: err });
    }
    text = cached;
    fromCache = true;
    const meta = await readJsonIfExists<{ fetchedAt?: string }>(metaFile).catch(() => null);
    fetchedAt = meta?.fetchedAt ?? fetchedAt;
    warnings.push(`Registry fetch failed (${(err as Error).message}); using cached registry from ${fetchedAt}.`);
  }

  const { index, total } = parseRegistry(text);
  if (index.skipped > 0) warnings.push(`${index.skipped} registry entries had an unexpected shape and were ignored.`);
  const commitSha = await fetchCommitSha(ctx, client);
  return {
    index,
    warnings,
    revision: {
      repository: ctx.config.source.repository,
      commitSha,
      registrySha256: sha256(text),
      registryTotal: total,
      fetchedAt,
      fromCache,
    },
  };
}

async function fetchCommitSha(ctx: ForgeContext, client: HttpClient): Promise<string | null> {
  const url = ctx.config.source.commitApiUrl;
  if (!url) return null;
  try {
    const body = JSON.parse(await client.getText(url)) as { sha?: unknown };
    return typeof body.sha === 'string' && /^[0-9a-f]{40}$/.test(body.sha) ? body.sha : null;
  } catch (err) {
    if (!(err instanceof NetworkError) && !(err instanceof SyntaxError)) throw err;
    ctx.logger.debug(`Commit SHA unavailable: ${(err as Error).message}`);
    return null;
  }
}

export function iconUrls(ctx: ForgeContext, slug: string, variant: string): string[] {
  const rel = `${encodeURIComponent(slug)}/${encodeURIComponent(variant)}.svg`;
  const urls = [`${ctx.config.source.iconBaseUrl}/${rel}`];
  if (ctx.config.source.fallbackIconBaseUrl) urls.push(`${ctx.config.source.fallbackIconBaseUrl}/${rel}`);
  return urls;
}

/** Downloads one variant SVG: primary host first, then the CDN mirror. Returns the text and the URL that served it. */
export async function downloadIconSvg(ctx: ForgeContext, http: HttpClient, slug: string, variant: string): Promise<{ text: string; url: string }> {
  let lastErr: unknown;
  for (const url of iconUrls(ctx, slug, variant)) {
    try {
      const text = await http.getText(url);
      if (!/<svg[\s>]/i.test(text)) throw new ForgeError({ code: 'NOT_SVG', stage: 'download', icon: slug, variant, message: `Response from ${url} is not an SVG.` });
      return { text, url };
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr instanceof ForgeError) throw new ForgeError({ code: lastErr.code, stage: 'download', icon: slug, variant, message: lastErr.message, recoverable: true });
  throw lastErr;
}
