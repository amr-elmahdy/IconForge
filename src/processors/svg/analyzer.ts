import { getAttr, walk, type ElementNode } from './xml.js';

export interface SvgAnalysis {
  viewBox: string | null;
  width: string | null;
  height: string | null;
  /** Explicit colors found in presentation attributes, inline styles and <style> blocks (never inferred). */
  colors: string[];
  usesCurrentColor: boolean;
}

const COLOR_ATTRS = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color'];
const COLOR_PROPS = new Set(COLOR_ATTRS);

function normalizeColor(raw: string): string | null {
  const v = raw.trim().toLowerCase().replace(/\s*!important$/, '');
  if (v === '' || v === 'none' || v === 'inherit' || v === 'transparent' || v === 'initial' || v === 'unset' || v.startsWith('url(')) return null;
  if (v === 'currentcolor') return 'currentcolor';
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return v.replace(/\s+/g, '');
}

function fromDeclarations(css: string, add: (c: string) => void): void {
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    if (COLOR_PROPS.has(prop)) add(decl.slice(i + 1));
  }
}

export function analyzeSvg(root: ElementNode): SvgAnalysis {
  const found = new Set<string>();
  let usesCurrentColor = false;
  const add = (raw: string): void => {
    const c = normalizeColor(raw);
    if (!c) return;
    if (c === 'currentcolor') usesCurrentColor = true;
    else found.add(c);
  };
  walk(root, (el) => {
    for (const a of COLOR_ATTRS) {
      const v = getAttr(el, a);
      if (v !== null) add(v);
    }
    const style = getAttr(el, 'style');
    if (style) fromDeclarations(style, add);
    if (el.name === 'style') {
      const css = el.children.map((c) => (c.type === 'element' ? '' : c.value)).join('');
      // declaration blocks: { ... }
      for (const m of css.matchAll(/\{([^}]*)\}/g)) fromDeclarations(m[1] ?? '', add);
    }
  });
  return {
    viewBox: getAttr(root, 'viewBox'),
    width: getAttr(root, 'width'),
    height: getAttr(root, 'height'),
    colors: [...found].sort(),
    usesCurrentColor,
  };
}
