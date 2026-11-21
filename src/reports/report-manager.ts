import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { atomicWrite, ensureDir } from '../utils/filesystem.js';

export function formatRunId(now: Date, suffix: string = randomBytes(4).toString('hex')): string {
  const p = (n: number, w = 2): string => String(n).padStart(w, '0');
  const ts = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
  return `${ts}-${suffix}`;
}

/** Creates a brand-new run directory. Uses non-recursive mkdir so an existing report folder can never be reused or overwritten. */
export async function createRunDir(reportsDir: string, now: Date): Promise<{ runId: string; dir: string }> {
  await ensureDir(reportsDir);
  for (let attempt = 0; attempt < 5; attempt++) {
    const runId = formatRunId(now);
    const dir = path.join(reportsDir, runId);
    try {
      await mkdir(dir);
      return { runId, dir };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
  }
  throw new Error('Could not allocate a unique run directory');
}

export async function writeReportFiles(dir: string, files: Record<string, string>): Promise<void> {
  for (const [name, content] of Object.entries(files)) await atomicWrite(path.join(dir, name), content);
}
