import { PROCESSING_VERSION } from '../../core/types.js';
import type { ProcessedSvg } from '../svg/process.js';
import type { RegistryEntry, SourceRevision } from '../../sources/thesvg/types.js';
import { stableStringify, sha256 } from '../../utils/hashing.js';
import type { IconRecord } from './schema.js';

/** Fingerprint of everything that should trigger reprocessing: the source entry, the processing version and the optimize switch. */
export function entryFingerprint(entry: RegistryEntry, optimize: boolean): string {
  return sha256(stableStringify({ entry, processingVersion: PROCESSING_VERSION, optimize }));
}

export function buildIconRecord(args: {
  entry: RegistryEntry;
  variant: string;
  filename: string;
  downloadUrl: string;
  originalSha256: string;
  processed: ProcessedSvg;
  revision: SourceRevision;
  optimize: boolean;
}): IconRecord {
  const { entry, processed } = args;
  return {
    slug: entry.slug,
    title: entry.title ?? null,
    aliases: entry.aliases ?? [],
    variant: args.variant,
    filename: args.filename,
    collection: null,
    categories: entry.categories ?? [],
    brandColorHex: entry.hex ?? null,
    source: {
      repository: args.revision.repository,
      url: entry.url ?? null,
      downloadUrl: args.downloadUrl,
      revision: args.revision.commitSha,
      registrySha256: args.revision.registrySha256,
      license: entry.license ?? null,
      licenseVerified: false,
      guidelinesUrl: entry.guidelines ?? null,
    },
    svg: {
      viewBox: processed.analysis.viewBox,
      width: processed.analysis.width,
      height: processed.analysis.height,
      colors: processed.analysis.colors,
      usesCurrentColor: processed.analysis.usesCurrentColor,
    },
    file: { size: processed.size, sha256: processed.sha256 },
    originalSha256: args.originalSha256,
    processing: {
      normalized: processed.flags.normalized,
      sanitized: processed.flags.sanitized,
      optimized: processed.flags.optimized,
      processingVersion: PROCESSING_VERSION,
      entryFingerprint: entryFingerprint(entry, args.optimize),
    },
  };
}

export function sortRecords(records: IconRecord[]): IconRecord[] {
  return [...records].sort((a, b) => (a.slug === b.slug ? (a.variant < b.variant ? -1 : a.variant > b.variant ? 1 : 0) : a.slug < b.slug ? -1 : 1));
}
