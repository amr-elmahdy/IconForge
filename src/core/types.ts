export const ICONFORGE_VERSION = '1.0.0';
export const SCHEMA_VERSION = 1;
/** Bump when SVG processing logic changes so cached outputs get reprocessed. */
export const PROCESSING_VERSION = 1;

export type Stage =
  | 'input'
  | 'registry'
  | 'resolve'
  | 'download'
  | 'parse'
  | 'sanitize'
  | 'optimize'
  | 'validate'
  | 'write'
  | 'metadata'
  | 'manifest'
  | 'report';

export interface IconError {
  code: string;
  stage: Stage;
  icon: string | null;
  variant: string | null;
  message: string;
  recoverable: boolean;
}

export interface IconWarning {
  code: string;
  stage: Stage;
  icon: string | null;
  variant: string | null;
  message: string;
}

export type FileChangeKind = 'new' | 'updated' | 'unchanged' | 'failed';

export interface IconCliOptions {
  verbose: boolean;
  dryRun: boolean;
  force: boolean;
  optimize: boolean;
  input: string | null;
  cwd: string;
}
