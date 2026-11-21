import path from 'node:path';
import { readdir } from 'node:fs/promises';
import type { ForgeContext } from '../../core/context.js';
import { ManifestSchema } from '../../processors/metadata/schema.js';
import { readJsonIfExists } from '../../utils/filesystem.js';

export async function infoCommand(ctx: ForgeContext): Promise<number> {
  const raw = await readJsonIfExists<unknown>(ctx.paths.manifestJson).catch(() => null);
  const m = raw ? ManifestSchema.safeParse(raw) : null;
  if (m?.success) {
    const d = m.data;
    ctx.logger.info(`Output: ${d.counts.icons} icons, ${d.counts.files} SVG files (schema v${d.schemaVersion}, IconForge ${d.iconforgeVersion})`);
    ctx.logger.info(`Generated: ${d.generatedAt}`);
    ctx.logger.info(`Source: ${d.source.repository} @ ${d.source.commitSha ?? 'unknown commit'} (registry ${d.source.registrySha256.slice(0, 12)})`);
  } else {
    ctx.logger.info('Output: no valid manifest yet. Run `iconforge build`.');
  }
  try {
    const runs = (await readdir(ctx.paths.reportsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    ctx.logger.info(`Reports: ${runs.length} run(s)${runs.length ? `, latest ${runs[runs.length - 1]} in ${path.relative(ctx.options.cwd, ctx.paths.reportsDir)}` : ''}`);
  } catch {
    ctx.logger.info('Reports: none');
  }
  try {
    const cache = (await readdir(ctx.paths.cacheDir)).filter((n) => n !== 'README.md');
    ctx.logger.info(`Cache: ${cache.length ? cache.join(', ') : 'empty'}`);
  } catch {
    ctx.logger.info('Cache: empty');
  }
  return 0;
}
