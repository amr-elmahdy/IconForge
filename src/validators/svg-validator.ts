import { ForgeError } from '../core/errors.js';
import { getAttr, parseSvg, walk } from '../processors/svg/xml.js';

const SHAPES = new Set(['path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'image', 'use']);

export interface SvgValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Structural checks on a final SVG string. */
export function validateSvgText(svg: string): SvgValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let parsed;
  try {
    parsed = parseSvg(svg);
  } catch (err) {
    return { ok: false, errors: [(err as ForgeError).message], warnings };
  }
  const { root } = parsed;
  if (root.name !== 'svg') errors.push(`root element is <${root.name}>, expected <svg>`);
  if (getAttr(root, 'xmlns') === null) errors.push('missing xmlns on root');
  const hasViewBox = getAttr(root, 'viewBox') !== null;
  if (!hasViewBox && (getAttr(root, 'width') === null || getAttr(root, 'height') === null)) errors.push('no viewBox and no width/height');
  if (hasViewBox && !/^\s*-?[\d.]+(?:[\s,]+-?[\d.]+){3}\s*$/.test(getAttr(root, 'viewBox') ?? '')) errors.push('malformed viewBox');
  let shapes = 0;
  walk(root, (el) => {
    if (SHAPES.has(el.name)) shapes++;
    if (el.name === 'script') errors.push('contains <script>');
    if (el.attrs.some(([k]) => /^on/i.test(k))) errors.push(`event handler on <${el.name}>`);
  });
  if (shapes === 0) errors.push('no visible shape elements');
  if (parsed.stats.comments > 0) warnings.push('contains comments');
  return { ok: errors.length === 0, errors, warnings };
}
