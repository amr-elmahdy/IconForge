import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { IconsFileSchema, ManifestSchema } from '../processors/metadata/schema.js';
import { sha256 } from '../utils/hashing.js';
import { listFiles, readTextIfExists } from '../utils/filesystem.js';
import { validateSvgText } from './svg-validator.js';

export interface OutputValidation {
  ok: boolean;
  checkedFiles: number;
  svgFailures: Array<{ file: string; errors: string[] }>;
  metadataErrors: string[];
  manifestErrors: string[];
  integrityErrors: string[];
  orphanFiles: string[];
}

/** Validates the on-disk output: SVG files, icons.json, manifest.json and hash consistency between them. */
export async function validateOutput(paths: { iconsDir: string; iconsJson: string; manifestJson: string }): Promise<OutputValidation> {
  const result: OutputValidation = { ok: true, checkedFiles: 0, svgFailures: [], metadataErrors: [], manifestErrors: [], integrityErrors: [], orphanFiles: [] };

  const iconsText = await readTextIfExists(paths.iconsJson);
  const manifestText = await readTextIfExists(paths.manifestJson);
  if (iconsText === null) result.metadataErrors.push('icons.json is missing');
  if (manifestText === null) result.manifestErrors.push('manifest.json is missing');

  const known = new Set<string>();
  if (iconsText !== null) {
    try {
      const parsed = IconsFileSchema.safeParse(JSON.parse(iconsText));
      if (!parsed.success) result.metadataErrors.push(...parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
      else {
        for (const rec of parsed.data.icons) {
          known.add(rec.filename);
          result.checkedFiles++;
          let content: string;
          try {
            content = await readFile(path.join(paths.iconsDir, rec.filename), 'utf8');
          } catch {
            result.integrityErrors.push(`${rec.filename}: listed in metadata but missing on disk`);
            continue;
          }
          if (sha256(content) !== rec.file.sha256) result.integrityErrors.push(`${rec.filename}: sha256 differs from metadata`);
          const v = validateSvgText(content);
          if (!v.ok) result.svgFailures.push({ file: rec.filename, errors: v.errors });
        }
      }
    } catch (err) {
      result.metadataErrors.push(`icons.json is not valid JSON: ${(err as Error).message}`);
    }
  }

  if (manifestText !== null) {
    try {
      const parsed = ManifestSchema.safeParse(JSON.parse(manifestText));
      if (!parsed.success) result.manifestErrors.push(...parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
      else {
        const files = parsed.data.icons.flatMap((i) => i.variants);
        if (files.length !== parsed.data.counts.files) result.manifestErrors.push('counts.files does not match listed variants');
        for (const f of files) if (iconsText !== null && !known.has(f.filename)) result.manifestErrors.push(`${f.filename}: in manifest but not in icons.json`);
      }
    } catch (err) {
      result.manifestErrors.push(`manifest.json is not valid JSON: ${(err as Error).message}`);
    }
  }

  for (const f of await listFiles(paths.iconsDir)) if (f.endsWith('.svg') && !known.has(f)) result.orphanFiles.push(f);
  result.ok = !result.svgFailures.length && !result.metadataErrors.length && !result.manifestErrors.length && !result.integrityErrors.length;
  return result;
}
