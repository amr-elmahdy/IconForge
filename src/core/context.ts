import path from 'node:path';
import type { ForgeConfig } from './config.js';
import type { Logger } from './logger.js';
import type { IconCliOptions } from './types.js';

export interface ForgeContext {
  config: ForgeConfig;
  options: IconCliOptions;
  logger: Logger;
  fetchImpl: typeof fetch;
  paths: {
    input: string;
    output: string;
    iconsDir: string;
    metadataDir: string;
    iconsJson: string;
    manifestJson: string;
    reportsDir: string;
    cacheDir: string;
  };
}

export function createContext(args: {
  config: ForgeConfig;
  options: IconCliOptions;
  logger: Logger;
  fetchImpl?: typeof fetch;
}): ForgeContext {
  const { config, options } = args;
  const root = options.cwd;
  const output = path.resolve(root, config.outputDir);
  return {
    config,
    options,
    logger: args.logger,
    fetchImpl: args.fetchImpl ?? fetch,
    paths: {
      input: path.resolve(root, options.input ?? config.inputFile),
      output,
      iconsDir: path.join(output, 'icons'),
      metadataDir: path.join(output, 'metadata'),
      iconsJson: path.join(output, 'metadata', 'icons.json'),
      manifestJson: path.join(output, 'metadata', 'manifest.json'),
      reportsDir: path.resolve(root, config.reportsDir),
      cacheDir: path.resolve(root, config.cacheDir),
    },
  };
}
