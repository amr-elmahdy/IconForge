import path from 'node:path';
import { readdir, rm } from 'node:fs/promises';
import type { ForgeContext } from '../../core/context.js';

/** Removes everything in cache/ except README.md. Never touches output/ or reports/. */
export async function cleanCacheCommand(ctx: ForgeContext): Promise<number> {
  let names: string[] = [];
  try {
    names = (await readdir(ctx.paths.cacheDir)).filter((n) => n !== 'README.md' && n !== '.gitkeep');
  } catch {
    names = [];
  }
  if (names.length === 0) {
    ctx.logger.info('Cache is already empty.');
    return 0;
  }
  for (const n of names) {
    if (ctx.options.dryRun) ctx.logger.info(`would remove cache/${n}`);
    else await rm(path.join(ctx.paths.cacheDir, n), { recursive: true, force: true });
  }
  ctx.logger.success(ctx.options.dryRun ? `Dry run: ${names.length} cache entr${names.length === 1 ? 'y' : 'ies'} would be removed.` : `Removed ${names.length} cache entr${names.length === 1 ? 'y' : 'ies'}.`);
  return 0;
}
