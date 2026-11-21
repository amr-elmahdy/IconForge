import { countElements, parseSvg, type ElementNode } from './xml.js';
import { analyzeSvg } from './analyzer.js';

/** Conservative SVGO plugin set: only comment/metadata/editor-data removal and attribute whitespace cleanup. No path or id rewriting, viewBox is never touched. */
export const CONSERVATIVE_SVGO_PLUGINS = [
  'removeDoctype',
  'removeXMLProcInst',
  'removeComments',
  'removeMetadata',
  'removeEditorsNSData',
  'cleanupAttrs',
] as const;

export type SvgoOptimize = (svg: string, config: { plugins: readonly string[]; multipass: boolean }) => { data: string };

export async function loadSvgo(): Promise<SvgoOptimize> {
  const mod = (await import('svgo')) as unknown as { optimize: SvgoOptimize };
  return mod.optimize;
}

const VISUAL_TAGS = new Set([
  'path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'image', 'use',
  'linearGradient', 'radialGradient', 'clipPath', 'mask', 'filter', 'pattern', 'symbol', 'stop',
]);

export function visualFingerprint(root: ElementNode): string {
  const counts = countElements(root, VISUAL_TAGS);
  const a = analyzeSvg(root);
  return JSON.stringify({ counts: Object.entries(counts).sort(), viewBox: a.viewBox, colors: a.colors, cc: a.usesCurrentColor });
}

export interface OptimizeResult {
  svg: string;
  optimized: boolean;
  warning: string | null;
}

/** Runs SVGO and verifies the visual fingerprint is unchanged; otherwise reverts to the input and reports why. */
export async function optimizeSvg(svg: string, run?: SvgoOptimize): Promise<OptimizeResult> {
  try {
    const optimize = run ?? (await loadSvgo());
    const out = optimize(svg, { plugins: CONSERVATIVE_SVGO_PLUGINS, multipass: false }).data;
    const before = visualFingerprint(parseSvg(svg).root);
    const reparsed = parseSvg(out).root;
    if (visualFingerprint(reparsed) !== before) {
      return { svg, optimized: false, warning: 'Optimizer changed visual structure; kept the unoptimized version.' };
    }
    return { svg: out.endsWith('\n') ? out : out + '\n', optimized: true, warning: null };
  } catch (err) {
    return { svg, optimized: false, warning: `Optimizer failed (${(err as Error).message}); kept the unoptimized version.` };
  }
}
