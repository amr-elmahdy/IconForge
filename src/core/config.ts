import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ForgeError } from './errors.js';

export const ConfigSchema = z.object({
  inputFile: z.string().min(1),
  outputDir: z.string().min(1),
  reportsDir: z.string().min(1),
  cacheDir: z.string().min(1),
  source: z.object({
    registryUrl: z.string().url(),
    iconBaseUrl: z.string().url(),
    fallbackIconBaseUrl: z.string().url().nullable(),
    repository: z.string().min(1),
    commitApiUrl: z.string().url().nullable(),
  }),
  network: z.object({
    concurrency: z.number().int().min(1).max(16),
    timeoutMs: z.number().int().min(1000),
    retries: z.number().int().min(0).max(8),
    retryBaseDelayMs: z.number().int().min(0),
  }),
  processing: z.object({
    optimize: z.boolean(),
    maxFileBytes: z.number().int().min(1024),
  }),
});
export type ForgeConfig = z.infer<typeof ConfigSchema>;

/** Package root: works from src/ (tsx) and dist/ (compiled) because both sit two levels below the root. */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Loads config/default.json, then an optional iconforge.config.json in cwd (merged per section). */
export async function loadConfig(cwd: string): Promise<ForgeConfig> {
  const defaults = await readJson(path.join(PACKAGE_ROOT, 'config', 'default.json'), true);
  let merged: Record<string, unknown> = defaults;
  const user = await readJson(path.join(cwd, 'iconforge.config.json'), false);
  if (user) {
    merged = { ...defaults, ...user };
    for (const key of ['source', 'network', 'processing']) {
      merged[key] = { ...(defaults[key] as object), ...((user[key] as object | undefined) ?? {}) };
    }
  }
  const parsed = ConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw new ForgeError({
      code: 'CONFIG_INVALID',
      stage: 'input',
      message: `Invalid configuration: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      recoverable: false,
    });
  }
  return parsed.data;
}

async function readJson(file: string, required: true): Promise<Record<string, unknown>>;
async function readJson(file: string, required: false): Promise<Record<string, unknown> | null>;
async function readJson(file: string, required: boolean): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT' && !required) return null;
    throw new ForgeError({
      code: 'CONFIG_READ',
      stage: 'input',
      message: `Cannot read ${file}: ${(err as Error).message}`,
      recoverable: false,
    });
  }
}
