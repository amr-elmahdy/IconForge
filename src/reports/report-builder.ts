import { ICONFORGE_VERSION, type FileChangeKind, type IconError, type IconWarning } from '../core/types.js';
import type { OutputValidation } from '../validators/output-validator.js';
import type { SourceRevision } from '../sources/thesvg/types.js';

export type RunStatus = 'success' | 'completed_with_warnings' | 'completed_with_errors' | 'failed';

export interface FileEntry {
  slug: string;
  variant: string;
  filename: string | null;
  status: FileChangeKind;
  downloaded: boolean;
  skippedReason: string | null;
  notes: string[];
}

export class ReportBuilder {
  readonly errors: IconError[] = [];
  readonly warnings: IconWarning[] = [];
  readonly files: FileEntry[] = [];
  readonly staleVariants: Array<{ slug: string; variant: string; filename: string }> = [];
  readonly metadataChanges: Array<{ slug: string; variant: string; kind: 'added' | 'changed' }> = [];
  requested = 0;
  found = 0;
  validation: OutputValidation | null = null;
  revision: SourceRevision | null = null;
  manifestWritten = false;
  metadataWritten = false;

  constructor(
    readonly runId: string,
    readonly startedAt: Date,
    readonly mode: { dryRun: boolean; force: boolean; optimize: boolean },
  ) {}

  addFile(f: FileEntry): void {
    this.files.push(f);
  }

  private count(k: FileChangeKind): number {
    return this.files.filter((f) => f.status === k).length;
  }

  status(fatal: boolean): RunStatus {
    if (fatal) return 'failed';
    if (this.errors.length > 0) return 'completed_with_errors';
    if (this.warnings.length > 0) return 'completed_with_warnings';
    return 'success';
  }

  /** 0 success, 1 some icons failed, 2 warnings only, 3 fatal (input/registry/config). */
  exitCode(fatal: boolean): number {
    if (fatal) return 3;
    if (this.errors.length > 0) return 1;
    if (this.warnings.length > 0) return 2;
    return 0;
  }

  build(finishedAt: Date, fatal: boolean): Record<string, string> {
    const status = this.status(fatal);
    const durationMs = finishedAt.getTime() - this.startedAt.getTime();
    const processed = this.files.filter((f) => f.status !== 'failed' && f.skippedReason === null).length;
    const counts = {
      requested: this.requested,
      found: this.found,
      files: this.files.length,
      downloaded: this.files.filter((f) => f.downloaded).length,
      processed,
      new: this.count('new'),
      updated: this.count('updated'),
      unchanged: this.count('unchanged'),
      failed: this.count('failed'),
      passedValidation: this.validation ? this.files.length - this.count('failed') - this.validation.svgFailures.length : null,
      warnings: this.warnings.length,
      errors: this.errors.length,
    };

    const report = {
      schemaVersion: 1,
      iconforgeVersion: ICONFORGE_VERSION,
      runId: this.runId,
      startedAt: this.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      status,
      mode: this.mode,
      source: this.revision,
      counts,
      files: this.files,
    };
    const changes = {
      runId: this.runId,
      newFiles: this.files.filter((f) => f.status === 'new').map((f) => f.filename),
      updatedFiles: this.files.filter((f) => f.status === 'updated').map((f) => f.filename),
      unchangedFiles: this.files.filter((f) => f.status === 'unchanged').map((f) => f.filename),
      staleVariants: this.staleVariants,
      metadataChanges: this.metadataChanges,
      metadataWritten: this.metadataWritten,
      manifestWritten: this.manifestWritten,
      dryRun: this.mode.dryRun,
    };
    const validation = this.validation ?? { skipped: true, reason: this.mode.dryRun ? 'dry-run' : 'not reached' };

    const fmt = (n: number | null): string => (n === null ? 'n/a' : String(n));
    const summary = [
      `# IconForge run ${this.runId}`,
      '',
      `- Status: **${status}**${this.mode.dryRun ? ' (dry run: nothing was written to output/)' : ''}`,
      `- Started: ${this.startedAt.toISOString()}`,
      `- Duration: ${(durationMs / 1000).toFixed(1)}s`,
      `- Icons requested: ${counts.requested}`,
      `- Icons found in source: ${counts.found}`,
      `- SVG files downloaded: ${counts.downloaded}`,
      `- SVG files processed: ${counts.processed}`,
      `- Files passed validation: ${fmt(counts.passedValidation)}`,
      `- Files failed: ${counts.failed}`,
      `- Warnings: ${counts.warnings}`,
      `- New / updated / unchanged: ${counts.new} / ${counts.updated} / ${counts.unchanged}`,
      this.revision ? `- Source: ${this.revision.repository} @ ${this.revision.commitSha ?? 'unknown commit'} (registry sha256 ${this.revision.registrySha256.slice(0, 12)}${this.revision.fromCache ? ', from cache' : ''})` : '- Source: not loaded',
      '',
      ...(this.errors.length ? ['## Errors', ...this.errors.map((e) => `- [${e.code}] ${e.icon ?? '-'}${e.variant ? '/' + e.variant : ''} (${e.stage}): ${e.message}`), ''] : []),
      ...(this.warnings.length ? ['## Warnings', ...this.warnings.map((w) => `- [${w.code}] ${w.icon ?? '-'}${w.variant ? '/' + w.variant : ''}: ${w.message}`), ''] : []),
    ].join('\n');

    return {
      'summary.md': summary + '\n',
      'report.json': JSON.stringify(report, null, 2) + '\n',
      'errors.json': JSON.stringify({ runId: this.runId, errors: this.errors }, null, 2) + '\n',
      'changes.json': JSON.stringify(changes, null, 2) + '\n',
      'validation.json': JSON.stringify({ runId: this.runId, ...validation }, null, 2) + '\n',
    };
  }
}
