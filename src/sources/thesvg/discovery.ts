import type { RegistryIndex } from './repository.js';
import type { RegistryEntry } from './types.js';
import type { InputEntry } from '../../input/reader.js';
import type { IconError, IconWarning } from '../../core/types.js';

export type Resolution =
  | { ok: true; entry: RegistryEntry; matchedBy: 'slug' | 'alias' }
  | { ok: false; code: 'ICON_NOT_FOUND' | 'ALIAS_AMBIGUOUS'; message: string };

/** Slug first (case-insensitive); then an alias only if it points to exactly one slug. */
export function resolveName(index: RegistryIndex, name: string): Resolution {
  const bySlug = index.getBySlug(name);
  if (bySlug) return { ok: true, entry: bySlug, matchedBy: 'slug' };
  const aliasHits = index.findByAlias(name);
  if (aliasHits.length === 1) {
    const entry = index.getBySlug(aliasHits[0] as string);
    if (entry) return { ok: true, entry, matchedBy: 'alias' };
  }
  if (aliasHits.length > 1) {
    return { ok: false, code: 'ALIAS_AMBIGUOUS', message: `"${name}" matches several icons (${aliasHits.join(', ')}). Use the exact slug.` };
  }
  const hint = index.suggest(name);
  return { ok: false, code: 'ICON_NOT_FOUND', message: `"${name}" was not found in the source${hint.length ? `. Did you mean: ${hint.join(', ')}?` : '.'}` };
}

export interface ResolvedIcon {
  requestedAs: string;
  line: number;
  matchedBy: 'slug' | 'alias';
  entry: RegistryEntry;
}

export interface DiscoveryResult {
  resolved: ResolvedIcon[];
  errors: IconError[];
  warnings: IconWarning[];
  duplicates: number;
}

/** Slug prefixes/suffixes that indicate non-brand collections in theSVG (the registry has no collection field). */
function nonBrandHint(slug: string): string | null {
  if (slug.endsWith('-badge')) return 'looks like an Auth Badge icon (different collection)';
  if (/^(aws|azure|gcp|k8s|kubernetes)-/.test(slug)) return 'looks like a cloud/architecture collection icon';
  return null;
}

export function discoverIcons(index: RegistryIndex, entries: InputEntry[]): DiscoveryResult {
  const resolved: ResolvedIcon[] = [];
  const errors: IconError[] = [];
  const warnings: IconWarning[] = [];
  const seen = new Map<string, number>(); // slug -> first line
  let duplicates = 0;

  for (const e of entries) {
    const r = resolveName(index, e.name);
    if (!r.ok) {
      errors.push({ code: r.code, stage: 'resolve', icon: e.name, variant: null, message: `Line ${e.line}: ${r.message}`, recoverable: true });
      continue;
    }
    const slug = r.entry.slug;
    const first = seen.get(slug);
    if (first !== undefined) {
      duplicates++;
      warnings.push({ code: 'DUPLICATE', stage: 'input', icon: slug, variant: null, message: `Line ${e.line}: "${e.name}" duplicates line ${first} (${slug}); ignored.` });
      continue;
    }
    seen.set(slug, e.line);
    const hint = nonBrandHint(slug);
    if (hint) warnings.push({ code: 'NON_BRAND_HINT', stage: 'resolve', icon: slug, variant: null, message: `Line ${e.line}: "${slug}" ${hint}. Processed anyway because it was requested explicitly.` });
    resolved.push({ requestedAs: e.name, line: e.line, matchedBy: r.matchedBy, entry: r.entry });
  }
  return { resolved, errors, warnings, duplicates };
}
