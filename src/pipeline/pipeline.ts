import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { ForgeContext } from '../core/context.js';
import { ForgeError, toForgeError } from '../core/errors.js';
import { ICONFORGE_VERSION, type FileChangeKind } from '../core/types.js';
import { readInputFile } from '../input/reader.js';
import { buildIconRecord, entryFingerprint, sortRecords } from '../processors/metadata/generator.js';
import { IconsFileSchema, METADATA_SCHEMA_VERSION, type IconRecord } from '../processors/metadata/schema.js';
import type { SvgoOptimize } from '../processors/svg/optimizer.js';
import { processSvg } from '../processors/svg/process.js';
import { buildManifest } from '../output/manifest.js';
import { assignFileNames } from '../output/naming.js';
import { writeJson, writeSvgIfChanged } from '../output/writer.js';
import { ReportBuilder } from '../reports/report-builder.js';
import { createRunDir, writeReportFiles } from '../reports/report-manager.js';
import { discoverIcons } from '../sources/thesvg/discovery.js';
import { createHttpClient, type HttpClient } from '../sources/thesvg/client.js';
import { downloadIconSvg, loadRegistry } from '../sources/thesvg/repository.js';
import { mapLimit } from '../utils/concurrency.js';
import { atomicWrite, exists, readJsonIfExists } from '../utils/filesystem.js';
import { sha256, stableStringify } from '../utils/hashing.js';
import { validateOutput } from '../validators/output-validator.js';

export interface BuildDeps {
  now?: () => Date;
  svgo?: SvgoOptimize;
  http?: HttpClient;
}

export interface BuildResult {
  exitCode: number;
  runId: string;
  runDir: string;
  report: ReportBuilder;
  fatal: boolean;
}

const key = (slug: string, variant: string): string => `${slug}\u0000${variant}`;

async function loadPreviousRecords(ctx: ForgeContext, report: ReportBuilder): Promise<IconRecord[]> {
  try {
    const raw = await readJsonIfExists<unknown>(ctx.paths.iconsJson);
    if (raw === null) return [];
    const parsed = IconsFileSchema.safeParse(raw);
    if (parsed.success) return parsed.data.icons;
    report.warnings.push({ code: 'METADATA_UNREADABLE', stage: 'metadata', icon: null, variant: null, message: 'Existing icons.json does not match the current schema; previous records are ignored (files are NOT deleted).' });
  } catch (err) {
    report.warnings.push({ code: 'METADATA_UNREADABLE', stage: 'metadata', icon: null, variant: null, message: `Existing icons.json could not be read (${(err as Error).message}); previous records are ignored (files are NOT deleted).` });
  }
  return [];
}

function withoutGeneratedAt<T extends { generatedAt?: string }>(o: T): Omit<T, 'generatedAt'> {
  const { generatedAt: _ignored, ...rest } = o;
  void _ignored;
  return rest;
}

export async function runBuild(ctx: ForgeContext, deps: BuildDeps = {}): Promise<BuildResult> {
  const now = deps.now ?? ((): Date => new Date());
  const startedAt = now();
  const { options, logger, config, paths } = ctx;
  const { runId, dir: runDir } = await createRunDir(paths.reportsDir, startedAt);
  const report = new ReportBuilder(runId, startedAt, { dryRun: options.dryRun, force: options.force, optimize: options.optimize });
  const http = deps.http ?? createHttpClient(ctx.fetchImpl, config.network);
  let fatal = false;

  try {
    // 1. input
    const entries = await readInputFile(paths.input);
    report.requested = entries.length;
    if (entries.length === 0) {
      throw new ForgeError({ code: 'INPUT_EMPTY', stage: 'input', message: `No icon names found in ${paths.input}. Add one name per line.`, recoverable: false });
    }

    // 2. registry + discovery
    logger.info(`Loading theSVG registry…`);
    const registry = await loadRegistry(ctx, http);
    report.revision = registry.revision;
    for (const w of registry.warnings) report.warnings.push({ code: 'REGISTRY_WARNING', stage: 'registry', icon: null, variant: null, message: w });
    const discovery = discoverIcons(registry.index, entries);
    report.found = discovery.resolved.length;
    report.errors.push(...discovery.errors);
    report.warnings.push(...discovery.warnings);
    for (const e of discovery.errors) logger.error(e.message);
    for (const w of discovery.warnings) logger.warn(w.message);

    // 3. previous state + file naming
    const previous = await loadPreviousRecords(ctx, report);
    const prevByKey = new Map(previous.map((r) => [key(r.slug, r.variant), r]));
    const requestedSlugs = new Set(discovery.resolved.map((r) => r.entry.slug));
    const reserved = new Map(previous.filter((r) => !requestedSlugs.has(r.slug)).map((r) => [r.filename, { slug: r.slug, variant: r.variant }]));
    const wanted = discovery.resolved.flatMap((r) => r.entry.variants.map((variant) => ({ slug: r.entry.slug, variant })));
    const uniqueWanted = [...new Map(wanted.map((w) => [key(w.slug, w.variant), w])).values()];
    const named = tryAssign(uniqueWanted, reserved, report);
    const entryBySlug = new Map(discovery.resolved.map((r) => [r.entry.slug, r.entry]));

    // 4. per-file work
    const updated = new Map<string, IconRecord>();
    let done = 0;
    const total = named.files.length;
    await mapLimit(named.files, config.network.concurrency, async (f) => {
      const entry = entryBySlug.get(f.slug);
      if (!entry) return;
      const label = `${f.slug}/${f.variant}`;
      try {
        const outcome = await processOne({ ctx, http, deps, entry, f, prev: prevByKey.get(key(f.slug, f.variant)) ?? null, revision: registry.revision });
        updated.set(key(f.slug, f.variant), outcome.record);
        for (const n of outcome.notes) report.warnings.push({ code: 'SVG_NOTE', stage: 'sanitize', icon: f.slug, variant: f.variant, message: n });
        report.addFile({ slug: f.slug, variant: f.variant, filename: f.filename, status: outcome.status, downloaded: outcome.downloaded, skippedReason: outcome.skippedReason, notes: outcome.notes });
        if (outcome.metadataChange) report.metadataChanges.push({ slug: f.slug, variant: f.variant, kind: outcome.metadataChange });
      } catch (err) {
        const fe = toForgeError(err, { stage: 'download', icon: f.slug, variant: f.variant });
        const rec = new ForgeError({ code: fe.code, stage: fe.stage, icon: f.slug, variant: f.variant, message: fe.message, recoverable: fe.recoverable });
        report.errors.push(rec.toRecord());
        report.addFile({ slug: f.slug, variant: f.variant, filename: f.filename, status: 'failed', downloaded: false, skippedReason: null, notes: [fe.message] });
        logger.error(`${label} [${fe.stage}] ${fe.message}`);
      } finally {
        logger.progress(++done, total, label);
      }
    });

    // stale variants: previously written, but gone from the source entry. Never deleted.
    for (const r of previous) {
      const entry = entryBySlug.get(r.slug);
      if (entry && !entry.variants.includes(r.variant)) {
        report.staleVariants.push({ slug: r.slug, variant: r.variant, filename: r.filename });
        report.warnings.push({ code: 'STALE_VARIANT', stage: 'metadata', icon: r.slug, variant: r.variant, message: `Variant no longer exists in source; local file ${r.filename} kept.` });
      }
    }

    // 5. metadata + manifest (previous records are preserved unless replaced by a successful update)
    const finalMap = new Map(previous.map((r) => [key(r.slug, r.variant), r]));
    for (const [k, r] of updated) finalMap.set(k, r);
    const records = sortRecords([...finalMap.values()]);
    if (!options.dryRun) {
      const finishedMeta = now();
      const nextIcons = { schemaVersion: METADATA_SCHEMA_VERSION, iconforgeVersion: ICONFORGE_VERSION, generatedAt: finishedMeta.toISOString(), icons: records };
      const prevFile = await readJsonIfExists<typeof nextIcons>(paths.iconsJson).catch(() => null);
      if (!prevFile || stableStringify(withoutGeneratedAt(prevFile)) !== stableStringify(withoutGeneratedAt(nextIcons))) {
        await writeJson(paths.iconsJson, nextIcons);
        report.metadataWritten = true;
      }
      const nextManifest = buildManifest(records, registry.revision, finishedMeta);
      const prevManifest = await readJsonIfExists<typeof nextManifest>(paths.manifestJson).catch(() => null);
      if (!prevManifest || stableStringify(withoutGeneratedAt(prevManifest)) !== stableStringify(withoutGeneratedAt(nextManifest))) {
        await writeJson(paths.manifestJson, nextManifest);
        report.manifestWritten = true;
      }
      report.validation = await validateOutput(paths);
      if (!report.validation.ok) {
        report.errors.push({ code: 'OUTPUT_VALIDATION_FAILED', stage: 'validate', icon: null, variant: null, message: 'Output validation found problems; see validation.json.', recoverable: true });
      }
    }
  } catch (err) {
    fatal = true;
    const fe = toForgeError(err, { stage: 'input' });
    report.errors.push({ ...fe.toRecord(), recoverable: false });
    logger.error(fe.message);
  }

  const finishedAt = now();
  try {
    await writeReportFiles(runDir, report.build(finishedAt, fatal));
  } catch (err) {
    logger.error(`Could not write report: ${(err as Error).message}`);
  }
  return { exitCode: report.exitCode(fatal), runId, runDir, report, fatal };
}

function tryAssign(items: Array<{ slug: string; variant: string }>, reserved: Map<string, { slug: string; variant: string }>, report: ReportBuilder): ReturnType<typeof assignFileNames> {
  const ok: typeof items = [];
  for (const it of items) {
    try {
      assignFileNames([it]);
      ok.push(it);
    } catch (err) {
      const fe = toForgeError(err, { stage: 'resolve', icon: it.slug, variant: it.variant });
      report.errors.push({ ...fe.toRecord(), icon: it.slug, variant: it.variant });
    }
  }
  const result = assignFileNames(ok, reserved);
  for (const c of result.collisions) {
    report.errors.push({ code: 'FILENAME_COLLISION', stage: 'write', icon: c.slug, variant: c.variant, message: `${c.filename} is already used by ${c.owner}; skipped.`, recoverable: true });
  }
  return result;
}

interface Outcome {
  record: IconRecord;
  status: FileChangeKind;
  downloaded: boolean;
  skippedReason: string | null;
  notes: string[];
  metadataChange: 'added' | 'changed' | null;
}

async function processOne(a: {
  ctx: ForgeContext;
  http: HttpClient;
  deps: BuildDeps;
  entry: import('../sources/thesvg/types.js').RegistryEntry;
  f: { slug: string; variant: string; filename: string };
  prev: IconRecord | null;
  revision: import('../sources/thesvg/types.js').SourceRevision;
}): Promise<Outcome> {
  const { ctx, f, entry, prev } = a;
  const { options, paths, config } = ctx;
  const fp = entryFingerprint(entry, options.optimize);
  const outFile = path.join(paths.iconsDir, f.filename);

  // Skip path: same source entry + same processing config + output present and intact -> no network, no work.
  if (!options.force && prev && prev.processing.entryFingerprint === fp && prev.filename === f.filename && (await exists(outFile))) {
    const onDisk = sha256(await readFile(outFile, 'utf8'));
    if (onDisk === prev.file.sha256) {
      return { record: prev, status: 'unchanged', downloaded: false, skippedReason: 'unchanged (fingerprint and hash match)', notes: [], metadataChange: null };
    }
  }

  // Raw source: reuse cached original when the source entry is unchanged and no force; otherwise download.
  const rawFile = path.join(paths.cacheDir, 'raw', f.slug, `${f.variant}.svg`);
  let rawText: string | null = null;
  let downloadUrl = `${config.source.iconBaseUrl}/${encodeURIComponent(f.slug)}/${encodeURIComponent(f.variant)}.svg`;
  let downloaded = false;
  if (!options.force && prev && prev.processing.entryFingerprint.length > 0 && (await exists(rawFile))) {
    const cached = await readFile(rawFile, 'utf8');
    if (sha256(cached) === prev.originalSha256) rawText = cached;
  }
  if (rawText === null) {
    const dl = await downloadIconSvg(ctx, a.http, f.slug, f.variant);
    rawText = dl.text;
    downloadUrl = dl.url;
    downloaded = true;
    if (!options.dryRun) await atomicWrite(rawFile, rawText);
  }

  const processed = await processSvg(rawText, { optimize: options.optimize, maxFileBytes: config.processing.maxFileBytes, ...(a.deps.svgo ? { svgo: a.deps.svgo } : {}) });
  const record = buildIconRecord({ entry, variant: f.variant, filename: f.filename, downloadUrl, originalSha256: sha256(rawText), processed, revision: a.revision, optimize: options.optimize });

  let status: FileChangeKind;
  if (options.dryRun) {
    status = !prev || !(await exists(outFile)) ? 'new' : sha256(await readFile(outFile, 'utf8')) === processed.sha256 ? 'unchanged' : 'updated';
  } else {
    status = await writeSvgIfChanged(paths.iconsDir, f.filename, processed.svg);
  }
  const metadataChange = !prev ? 'added' : stableStringify(prev) !== stableStringify(record) ? 'changed' : null;
  return { record, status, downloaded, skippedReason: null, notes: processed.notes, metadataChange };
}
