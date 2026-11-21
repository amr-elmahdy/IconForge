import { ForgeError } from '../../core/errors.js';
import { getAttr, walk, type ElementNode } from './xml.js';

export interface SanitizeResult {
  /** Human-readable list of non-destructive removals (never silent). */
  changes: string[];
}

/** Elements that cannot be removed without risking a visual change, so the file is rejected. */
const REJECT_ELEMENTS = new Set(['foreignObject', 'iframe', 'embed', 'object', 'applet', 'audio', 'video', 'canvas', 'html', 'body']);
const HREF_ATTRS = new Set(['href', 'xlink:href']);
const SAFE_DATA_URI = /^data:image\/(png|jpe?g|gif|webp|svg\+xml)(;[a-z0-9=._-]+)*(;base64)?,/i;

function reject(code: string, message: string): never {
  throw new ForgeError({ code, stage: 'sanitize', message, recoverable: true });
}

function checkUrlRefs(value: string, where: string): void {
  if (/javascript:/i.test(value)) reject('SVG_JS_URL', `${where} contains a javascript: URL.`);
  for (const m of value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    const target = (m[2] ?? '').trim();
    if (target.startsWith('#') || SAFE_DATA_URI.test(target)) continue;
    reject('SVG_EXTERNAL_REFERENCE', `${where} references an external resource via url(${target.slice(0, 60)}).`);
  }
  if (/@import/i.test(value)) reject('SVG_EXTERNAL_REFERENCE', `${where} uses @import.`);
  if (/expression\s*\(/i.test(value)) reject('SVG_UNSAFE_CSS', `${where} uses CSS expression().`);
}

/**
 * Safe sanitization. Removes only things that never affect rendering (scripts, event handlers, links) and records each removal.
 * Anything whose removal could change the icon (foreignObject, external resources, javascript: URLs) rejects the file instead.
 */
export function sanitizeSvg(root: ElementNode): SanitizeResult {
  const changes: string[] = [];
  const toRemove: Array<{ parent: ElementNode; child: ElementNode }> = [];

  walk(root, (el, parent) => {
    if (REJECT_ELEMENTS.has(el.name)) reject('SVG_FORBIDDEN_ELEMENT', `Element <${el.name}> cannot be sanitized without risking a visual change.`);
    if (el.name === 'script') {
      if (parent) toRemove.push({ parent, child: el });
      changes.push('removed <script> element');
      return;
    }
    if ((el.name === 'set' || el.name === 'animate') && HREF_ATTRS.has(getAttr(el, 'attributeName') ?? '')) {
      reject('SVG_UNSAFE_ANIMATION', `<${el.name}> animates an href attribute.`);
    }
    const kept: Array<[string, string]> = [];
    for (const [name, value] of el.attrs) {
      if (/^on/i.test(name)) {
        changes.push(`removed event handler ${name} on <${el.name}>`);
        continue;
      }
      if (HREF_ATTRS.has(name)) {
        const v = value.trim();
        if (/^javascript:/i.test(v)) reject('SVG_JS_URL', `<${el.name}> ${name} is a javascript: URL.`);
        const ok = v.startsWith('#') || SAFE_DATA_URI.test(v);
        if (!ok) {
          if (el.name === 'a') {
            changes.push(`removed external link ${name} on <a>`);
            continue;
          }
          reject('SVG_EXTERNAL_REFERENCE', `<${el.name}> ${name} points to an external resource (${v.slice(0, 60)}).`);
        }
      } else {
        checkUrlRefs(value, `<${el.name}> ${name}`);
      }
      kept.push([name, value]);
    }
    el.attrs = kept;
    if (el.name === 'style') {
      checkUrlRefs(el.children.map((c) => (c.type === 'element' ? '' : c.value)).join(''), '<style>');
    }
  });

  for (const { parent, child } of toRemove) parent.children = parent.children.filter((c) => c !== child);
  return { changes };
}
