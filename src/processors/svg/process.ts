import { ForgeError } from '../../core/errors.js';
import { sha256 } from '../../utils/hashing.js';
import { analyzeSvg, type SvgAnalysis } from './analyzer.js';
import { normalizeSvg } from './normalizer.js';
import { optimizeSvg, visualFingerprint, type SvgoOptimize } from './optimizer.js';
import { sanitizeSvg } from './sanitizer.js';
import { parseSvg, serializeSvg } from './xml.js';
import { validateSvgText } from '../../validators/svg-validator.js';

export interface ProcessedSvg {
  svg: string;
  sha256: string;
  size: number;
  analysis: SvgAnalysis;
  flags: { normalized: boolean; sanitized: boolean; optimized: boolean };
  /** Non-fatal notes: removals performed by the sanitizer, optimizer reverts, etc. */
  notes: string[];
}

export interface ProcessOptions {
  optimize: boolean;
  maxFileBytes: number;
  svgo?: SvgoOptimize;
}

/**
 * Original -> parse -> structure check -> analysis -> normalize -> sanitize -> optimize -> serialize -> final validation -> hash.
 * Throws ForgeError (recoverable) when the file must be rejected.
 */
export async function processSvg(original: string, opts: ProcessOptions): Promise<ProcessedSvg> {
  if (Buffer.byteLength(original, 'utf8') > opts.maxFileBytes) {
    throw new ForgeError({ code: 'SVG_TOO_LARGE', stage: 'parse', message: `SVG exceeds ${opts.maxFileBytes} bytes.` });
  }
  const parsed = parseSvg(original);
  const originalFingerprint = visualFingerprint(parsed.root);
  const notes: string[] = [];

  normalizeSvg(parsed.root, parsed.stats);
  const san = sanitizeSvg(parsed.root);
  notes.push(...san.changes);

  let svg = serializeSvg(parsed.root);
  let optimized = false;
  if (opts.optimize) {
    const res = await optimizeSvg(svg, opts.svgo);
    svg = res.svg;
    optimized = res.optimized;
    if (res.warning) notes.push(res.warning);
  }

  const finalParsed = parseSvg(svg);
  if (visualFingerprint(finalParsed.root) !== originalFingerprint) {
    throw new ForgeError({ code: 'SVG_VISUAL_DRIFT', stage: 'validate', message: 'Processing changed the icon structure; file rejected to protect the original look.' });
  }
  const problems = validateSvgText(svg).errors;
  if (problems.length > 0) {
    throw new ForgeError({ code: 'SVG_INVALID', stage: 'validate', message: `Processed SVG failed validation: ${problems.join('; ')}` });
  }
  return {
    svg,
    sha256: sha256(svg),
    size: Buffer.byteLength(svg, 'utf8'),
    analysis: analyzeSvg(finalParsed.root),
    flags: { normalized: true, sanitized: true, optimized },
    notes,
  };
}
