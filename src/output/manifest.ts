import { ICONFORGE_VERSION } from '../core/types.js';
import { METADATA_SCHEMA_VERSION, type IconRecord, type Manifest } from '../processors/metadata/schema.js';
import type { SourceRevision } from '../sources/thesvg/types.js';

/** Light entry point for consumers: slug -> variants -> filename + hash. Full details live in icons.json. */
export function buildManifest(records: IconRecord[], revision: SourceRevision, now: Date): Manifest {
  const bySlug = new Map<string, IconRecord[]>();
  for (const r of records) bySlug.set(r.slug, [...(bySlug.get(r.slug) ?? []), r]);
  const slugs = [...bySlug.keys()].sort();
  return {
    schemaVersion: METADATA_SCHEMA_VERSION,
    iconforgeVersion: ICONFORGE_VERSION,
    generatedAt: now.toISOString(),
    source: {
      repository: revision.repository,
      commitSha: revision.commitSha,
      registrySha256: revision.registrySha256,
      registryTotal: revision.registryTotal,
    },
    counts: { icons: slugs.length, files: records.length, variants: records.length },
    metadata: { icons: 'icons.json' },
    iconsDir: '../icons',
    icons: slugs.map((slug) => {
      const list = (bySlug.get(slug) ?? []).sort((a, b) => (a.variant < b.variant ? -1 : 1));
      return {
        slug,
        title: list[0]?.title ?? null,
        variants: list.map((r) => ({ variant: r.variant, filename: r.filename, sha256: r.file.sha256 })),
      };
    }),
  };
}
