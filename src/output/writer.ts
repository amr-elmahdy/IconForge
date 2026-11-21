import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { sha256 } from '../utils/hashing.js';
import { atomicWrite } from '../utils/filesystem.js';

/** Writes an SVG only if content differs. Returns the change kind. Existing file is never touched on failure (atomic). */
export async function writeSvgIfChanged(iconsDir: string, filename: string, content: string): Promise<'new' | 'updated' | 'unchanged'> {
  const target = path.join(iconsDir, filename);
  let existing: string | null = null;
  try {
    existing = await readFile(target, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  if (existing !== null && sha256(existing) === sha256(content)) return 'unchanged';
  await atomicWrite(target, content);
  return existing === null ? 'new' : 'updated';
}

/** JSON files are written with stable formatting; generatedAt-only differences are the caller's concern. */
export async function writeJson(file: string, data: unknown): Promise<void> {
  await atomicWrite(file, JSON.stringify(data, null, 2) + '\n');
}
