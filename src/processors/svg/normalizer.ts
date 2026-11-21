import { getAttr, type ElementNode } from './xml.js';
import type { ParseStats } from './xml.js';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export interface NormalizeResult {
  changes: string[];
}

/**
 * Structural normalization only (no visual changes): ensure the SVG namespace is declared; the serializer then drops
 * comments/doctype/XML declaration/insignificant whitespace. Attribute order and values are left as the source wrote them.
 */
export function normalizeSvg(root: ElementNode, stats: ParseStats): NormalizeResult {
  const changes: string[] = [];
  if (getAttr(root, 'xmlns') === null) {
    root.attrs.unshift(['xmlns', SVG_NS]);
    changes.push('added missing xmlns on <svg>');
  }
  if (stats.comments > 0) changes.push(`removed ${stats.comments} comment(s)`);
  if (stats.doctype) changes.push('removed DOCTYPE');
  if (stats.processingInstructions > 0) changes.push('removed XML declaration / processing instructions');
  return { changes };
}
