import type { ForgeContext } from '../../core/context.js';
import { validateOutput } from '../../validators/output-validator.js';

export async function validateCommand(ctx: ForgeContext): Promise<number> {
  const v = await validateOutput(ctx.paths);
  const problems = [
    ...v.metadataErrors.map((m) => `icons.json: ${m}`),
    ...v.manifestErrors.map((m) => `manifest.json: ${m}`),
    ...v.integrityErrors,
    ...v.svgFailures.map((f) => `${f.file}: ${f.errors.join('; ')}`),
  ];
  for (const p of problems) ctx.logger.error(p);
  for (const o of v.orphanFiles) ctx.logger.warn(`${o}: SVG on disk but not listed in metadata (not deleted)`);
  if (v.ok) {
    ctx.logger.success(`Output is valid (${v.checkedFiles} files checked).`);
    return v.orphanFiles.length ? 2 : 0;
  }
  return 1;
}
