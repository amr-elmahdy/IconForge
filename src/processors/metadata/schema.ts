import { z } from 'zod';

export const METADATA_SCHEMA_VERSION = 1;

export const IconRecordSchema = z.object({
  slug: z.string(),
  title: z.string().nullable(),
  aliases: z.array(z.string()),
  variant: z.string(),
  filename: z.string(),
  /** theSVG's registry has no collection field, so this is always null in v1 (not guessed). */
  collection: z.string().nullable(),
  categories: z.array(z.string()),
  brandColorHex: z.string().nullable(),
  source: z.object({
    repository: z.string(),
    url: z.string().nullable(),
    downloadUrl: z.string(),
    revision: z.string().nullable(),
    registrySha256: z.string(),
    license: z.string().nullable(),
    /** Always false: IconForge never verifies licenses. The registry string is reported as-is. */
    licenseVerified: z.literal(false),
    guidelinesUrl: z.string().nullable(),
  }),
  svg: z.object({
    viewBox: z.string().nullable(),
    width: z.string().nullable(),
    height: z.string().nullable(),
    colors: z.array(z.string()),
    usesCurrentColor: z.boolean(),
  }),
  file: z.object({ size: z.number().int().nonnegative(), sha256: z.string().length(64) }),
  originalSha256: z.string().length(64),
  processing: z.object({
    normalized: z.boolean(),
    sanitized: z.boolean(),
    optimized: z.boolean(),
    processingVersion: z.number().int(),
    entryFingerprint: z.string(),
  }),
});
export type IconRecord = z.infer<typeof IconRecordSchema>;

export const IconsFileSchema = z.object({
  schemaVersion: z.literal(METADATA_SCHEMA_VERSION),
  iconforgeVersion: z.string(),
  generatedAt: z.string(),
  icons: z.array(IconRecordSchema),
});
export type IconsFile = z.infer<typeof IconsFileSchema>;

export const ManifestSchema = z.object({
  schemaVersion: z.literal(METADATA_SCHEMA_VERSION),
  iconforgeVersion: z.string(),
  generatedAt: z.string(),
  source: z.object({
    repository: z.string(),
    commitSha: z.string().nullable(),
    registrySha256: z.string(),
    registryTotal: z.number().int(),
  }),
  counts: z.object({ icons: z.number().int(), files: z.number().int(), variants: z.number().int() }),
  metadata: z.object({ icons: z.string() }),
  iconsDir: z.string(),
  icons: z.array(
    z.object({
      slug: z.string(),
      title: z.string().nullable(),
      variants: z.array(z.object({ variant: z.string(), filename: z.string(), sha256: z.string().length(64) })),
    }),
  ),
});
export type Manifest = z.infer<typeof ManifestSchema>;
