import { ForgeError } from '../core/errors.js';

const SLUG_RE = /^[a-z0-9][a-z0-9._-]*$/;

/** "wordmarkLight" -> "wordmark-light"; "iconDark" -> "icon-dark"; "16" -> "16". */
export function variantToKebab(variant: string): string {
  return variant
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function assertSafeSlug(slug: string): void {
  if (!SLUG_RE.test(slug) || slug.includes('..')) {
    throw new ForgeError({ code: 'UNSAFE_SLUG', stage: 'resolve', icon: slug, message: `Slug "${slug}" is not safe to use as a file name.` });
  }
}

/** "default" -> "<slug>.svg"; other variants -> "<slug>-<kebab-variant>.svg". */
export function fileNameFor(slug: string, variant: string): string {
  assertSafeSlug(slug);
  if (variant === 'default') return `${slug}.svg`;
  const suffix = variantToKebab(variant);
  if (!suffix) throw new ForgeError({ code: 'UNSAFE_VARIANT', stage: 'resolve', icon: slug, variant, message: `Variant "${variant}" cannot be turned into a file name.` });
  return `${slug}-${suffix}.svg`;
}

export interface NamedFile {
  slug: string;
  variant: string;
  filename: string;
}

/**
 * Detects name collisions, e.g. slug "foo" variant "mono" vs slug "foo-mono" variant "default".
 * The first occurrence (in input order) keeps the name; later ones are reported as collisions.
 * `reserved` maps filenames already owned by other slug/variant pairs (from previous runs).
 */
export function assignFileNames(
  items: ReadonlyArray<{ slug: string; variant: string }>,
  reserved: ReadonlyMap<string, { slug: string; variant: string }> = new Map(),
): { files: NamedFile[]; collisions: Array<{ slug: string; variant: string; filename: string; owner: string }> } {
  const owners = new Map<string, { slug: string; variant: string }>(reserved);
  const files: NamedFile[] = [];
  const collisions: Array<{ slug: string; variant: string; filename: string; owner: string }> = [];
  for (const it of items) {
    const filename = fileNameFor(it.slug, it.variant);
    const owner = owners.get(filename);
    if (owner && (owner.slug !== it.slug || owner.variant !== it.variant)) {
      collisions.push({ ...it, filename, owner: `${owner.slug}/${owner.variant}` });
      continue;
    }
    owners.set(filename, it);
    files.push({ ...it, filename });
  }
  return { files, collisions };
}
