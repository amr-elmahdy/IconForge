import type { ForgeContext } from '../../core/context.js';
import { runBuild, type BuildDeps } from '../../pipeline/pipeline.js';

export async function buildCommand(ctx: ForgeContext, deps: BuildDeps = {}): Promise<number> {
  const result = await runBuild(ctx, deps);
  const c = result.report;
  const files = c.files;
  const failed = files.filter((f) => f.status === 'failed').length;
  const ok = files.length - failed;
  ctx.logger.info('');
  const line = `${c.found}/${c.requested} icons found · ${ok} files OK (${files.filter((f) => f.status === 'new').length} new, ${files.filter((f) => f.status === 'updated').length} updated, ${files.filter((f) => f.status === 'unchanged').length} unchanged) · ${failed} failed · ${c.warnings.length} warning(s)`;
  if (result.fatal) ctx.logger.error(`Run failed. ${c.errors[c.errors.length - 1]?.message ?? ''}`);
  else if (result.exitCode === 0) ctx.logger.success(line);
  else if (result.exitCode === 2) ctx.logger.warn(line);
  else ctx.logger.error(line);
  if (ctx.options.dryRun) ctx.logger.info('Dry run: output/ and cache/ were not modified.');
  ctx.logger.info(`Report: ${result.runDir}`);
  return result.exitCode;
}
