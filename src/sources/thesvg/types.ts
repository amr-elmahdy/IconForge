import { z } from 'zod';

/**
 * Shape of https://thesvg.org/api/registry.json as observed on 2026-11-21:
 * { total, icons: [{ slug, title, aliases[], categories[], hex, url, guidelines, links, license, variants[] }] }
 * Only `slug` and `variants` are required; everything else is tolerated as missing/null so source changes
 * don't break the run. The registry has NO explicit "collection" field.
 */
export const RegistryEntrySchema = z.object({
  slug: z.string().min(1),
  title: z.string().nullish(),
  aliases: z.array(z.string()).nullish(),
  categories: z.array(z.string()).nullish(),
  hex: z.string().nullish(),
  url: z.string().nullish(),
  guidelines: z.string().nullish(),
  links: z.record(z.string()).nullish(),
  license: z.string().nullish(),
  variants: z.array(z.string()).min(1),
});
export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;

export const RegistrySchema = z.object({
  total: z.number().optional(),
  icons: z.array(z.unknown()),
});

export interface SourceRevision {
  repository: string;
  commitSha: string | null;
  registrySha256: string;
  registryTotal: number;
  fetchedAt: string;
  /** true when the registry came from the local cache because the network failed. */
  fromCache: boolean;
}
