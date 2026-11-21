import sax from 'sax';
import { ForgeError } from '../../core/errors.js';

export interface ElementNode {
  type: 'element';
  name: string;
  /** Attributes in original order. */
  attrs: Array<[string, string]>;
  children: SvgNode[];
}
export interface TextNode {
  type: 'text';
  value: string;
}
export interface CdataNode {
  type: 'cdata';
  value: string;
}
export type SvgNode = ElementNode | TextNode | CdataNode;

export interface ParseStats {
  comments: number;
  processingInstructions: number;
  doctype: boolean;
}

export interface ParsedSvg {
  root: ElementNode;
  stats: ParseStats;
}

/** Real XML parsing via sax (strict mode, predefined entities only). No regex parsing of markup. */
export function parseSvg(text: string): ParsedSvg {
  // strictEntities is a valid sax runtime option missing from the bundled SAXOptions type
  const parser = sax.parser(true, { trim: false, normalize: false, lowercase: false, xmlns: false, position: false, strictEntities: true } as sax.SAXOptions);
  const stack: ElementNode[] = [];
  let root: ElementNode | null = null;
  const stats: ParseStats = { comments: 0, processingInstructions: 0, doctype: false };
  let failure: Error | null = null;

  parser.onerror = (e: Error): void => {
    failure = failure ?? e;
    parser.error = null as unknown as Error; // allow sax to stop cleanly
  };
  parser.ondoctype = (d: string): void => {
    stats.doctype = true;
    if (/<!ENTITY/i.test(d)) failure = failure ?? new Error('DOCTYPE with ENTITY declarations is not allowed');
  };
  parser.oncomment = (): void => {
    stats.comments++;
  };
  parser.onprocessinginstruction = (): void => {
    stats.processingInstructions++;
  };
  parser.onopentag = (tag: sax.Tag | sax.QualifiedTag): void => {
    if (root && stack.length === 0) {
      failure = failure ?? new Error('Multiple root elements');
      return;
    }
    const node: ElementNode = {
      type: 'element',
      name: tag.name,
      attrs: Object.entries(tag.attributes as Record<string, string>),
      children: [],
    };
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else root = node;
    stack.push(node);
  };
  parser.onclosetag = (): void => {
    stack.pop();
  };
  parser.ontext = (t: string): void => {
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push({ type: 'text', value: t });
  };
  parser.oncdata = (t: string): void => {
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push({ type: 'cdata', value: t });
  };

  try {
    parser.write(text).close();
  } catch (err) {
    failure = failure ?? (err as Error);
  }
  if (!failure && stack.length > 0) failure = new Error('Unclosed element');
  if (failure || !root) {
    throw new ForgeError({
      code: 'SVG_PARSE_ERROR',
      stage: 'parse',
      message: `Invalid SVG/XML: ${(failure as Error | null)?.message.split('\n')[0] ?? 'no root element'}`,
      recoverable: true,
    });
  }
  return { root, stats };
}

const PRESERVE_WS = new Set(['text', 'tspan', 'textPath', 'style', 'title', 'desc', 'script', 'pre']);

const escText = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/\t/g, '&#9;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;');

function serializeNode(node: SvgNode, out: string[], preserve: boolean): void {
  if (node.type === 'text') {
    out.push(escText(node.value));
    return;
  }
  if (node.type === 'cdata') {
    out.push(`<![CDATA[${node.value.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`);
    return;
  }
  const attrs = node.attrs.map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('');
  const keepWs =
    preserve ||
    PRESERVE_WS.has(node.name) ||
    node.attrs.some(([k, v]) => k === 'xml:space' && v === 'preserve') ||
    node.children.some((c) => c.type === 'cdata' || (c.type === 'text' && c.value.trim() !== ''));
  const children = keepWs ? node.children : node.children.filter((c) => !(c.type === 'text' && c.value.trim() === ''));
  if (children.length === 0) {
    out.push(`<${node.name}${attrs}/>`);
    return;
  }
  out.push(`<${node.name}${attrs}>`);
  for (const c of children) serializeNode(c, out, keepWs);
  out.push(`</${node.name}>`);
}

/** Deterministic serialization: no XML declaration, no comments, single trailing newline. */
export function serializeSvg(root: ElementNode): string {
  const out: string[] = [];
  serializeNode(root, out, false);
  return out.join('') + '\n';
}

export function walk(node: ElementNode, visit: (el: ElementNode, parent: ElementNode | null) => void, parent: ElementNode | null = null): void {
  visit(node, parent);
  for (const c of [...node.children]) if (c.type === 'element') walk(c, visit, node);
}

export function getAttr(el: ElementNode, name: string): string | null {
  const found = el.attrs.find(([k]) => k === name);
  return found ? found[1] : null;
}

export function countElements(root: ElementNode, names: ReadonlySet<string>): Record<string, number> {
  const counts: Record<string, number> = {};
  walk(root, (el) => {
    if (names.has(el.name)) counts[el.name] = (counts[el.name] ?? 0) + 1;
  });
  return counts;
}
