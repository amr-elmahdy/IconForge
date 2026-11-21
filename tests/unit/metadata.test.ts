import { describe, expect, it } from 'vitest';
import { buildIconRecord } from '../../src/processors/metadata/generator.js';
import { IconsFileSchema, ManifestSchema } from '../../src/processors/metadata/schema.js';
import { processSvg } from '../../src/processors/svg/process.js';
import { buildManifest } from '../../src/output/manifest.js';
import { parseRegistry } from '../../src/sources/thesvg/repository.js';
import { sha256, stableStringify } from '../../src/utils/hashing.js';
import { fixture } from '../helpers.js';

const revision = { repository: 'glincker/thesvg', commitSha: null, registrySha256: 'a'.repeat(64), registryTotal: 4, fetchedAt: '2026-11-21T00:00:00.000Z', fromCache: false };

async function record(slug: string, variant: string) {
  const { index } = parseRegistry(await fixture('registry.json'));
  const entry = index.getBySlug(slug)!;
  const processed = await processSvg(await fixture('valid.svg'), { optimize: false, maxFileBytes: 1e6 });
  return buildIconRecord({ entry, variant, filename: variant === 'default' ? `${slug}.svg` : `${slug}-${variant}.svg`, downloadUrl: 'https://thesvg.org/x.svg', originalSha256: sha256('orig'), processed, revision, optimize: false });
}

describe('metadata', () => {
  it('only carries source facts and marks missing ones as null / unverified', async () => {
    const r = await record('foo', 'default');
    expect(r.source.license).toBeNull();
    expect(r.source.url).toBeNull();
    expect(r.source.revision).toBeNull();
    expect(r.source.licenseVerified).toBe(false);
    expect(r.collection).toBeNull();
    expect(r.brandColorHex).toBeNull();
    expect(r.variant).toBe('default');
  });
  it('keeps the original variant name and registry license string', async () => {
    const r = await record('react', 'wordmarkLight');
    expect(r.variant).toBe('wordmarkLight');
    expect(r.filename).toBe('react-wordmarkLight.svg');
    expect(r.source.license).toBe('CC0-1.0');
    expect(r.aliases).toEqual(['reactjs']);
    expect(r.svg.colors).toEqual(['#aabbcc', '#ff0000', '#ffffff']);
  });
  it('produces schema-valid icons.json and manifest.json with a schema version', async () => {
    const recs = [await record('react', 'default'), await record('react', 'mono'), await record('github', 'default')];
    const icons = { schemaVersion: 1 as const, iconforgeVersion: '1.0.0', generatedAt: 'now', icons: recs };
    expect(IconsFileSchema.safeParse(icons).success).toBe(true);
    const manifest = buildManifest(recs, revision, new Date('2026-11-21T10:00:00Z'));
    expect(ManifestSchema.safeParse(manifest).success).toBe(true);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.counts).toEqual({ icons: 2, files: 3, variants: 3 });
    expect(manifest.icons.map((i) => i.slug)).toEqual(['github', 'react']);
    expect(manifest.icons[1]?.variants.map((v) => v.variant)).toEqual(['default', 'mono']);
    expect(manifest.icons[1]?.variants[0]?.sha256).toBe(recs[0]?.file.sha256);
    expect(manifest.generatedAt).toBe('2026-11-21T10:00:00.000Z');
  });
});

describe('hashing', () => {
  it('computes sha256 and stable JSON independent of key order', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(stableStringify({ b: 1, a: { d: 1, c: 2 } })).toBe(stableStringify({ a: { c: 2, d: 1 }, b: 1 }));
  });
});
