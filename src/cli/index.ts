#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../core/config.js';
import { createContext } from '../core/context.js';
import { ForgeError } from '../core/errors.js';
import { createLogger, type Logger } from '../core/logger.js';
import { ICONFORGE_VERSION, type IconCliOptions } from '../core/types.js';
import type { BuildDeps } from '../pipeline/pipeline.js';
import { buildCommand } from './commands/build.js';
import { cleanCacheCommand } from './commands/clean-cache.js';
import { HELP_TEXT } from './commands/help.js';
import { infoCommand } from './commands/info.js';
import { validateCommand } from './commands/validate.js';

export interface ParsedArgs {
  command: string;
  options: Omit<IconCliOptions, 'cwd'>;
  showHelp: boolean;
  showVersion: boolean;
}

const COMMANDS = new Set(['build', 'validate', 'info', 'clean-cache', 'help']);

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const options: ParsedArgs['options'] = { verbose: false, dryRun: false, force: false, optimize: true, input: null };
  let command: string | null = null;
  let showHelp = false;
  let showVersion = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === '--verbose') options.verbose = true;
    else if (a === '--dry-run') options.dryRun = true;
    else if (a === '--force') options.force = true;
    else if (a === '--no-optimize') options.optimize = false;
    else if (a === '-h' || a === '--help') showHelp = true;
    else if (a === '-v' || a === '--version') showVersion = true;
    else if (a === '--input' || a.startsWith('--input=')) {
      const value = a === '--input' ? argv[++i] : a.slice('--input='.length);
      if (!value || value.startsWith('--')) throw new ForgeError({ code: 'USAGE', stage: 'input', message: '--input requires a path.', recoverable: false });
      options.input = value;
    } else if (a.startsWith('-')) throw new ForgeError({ code: 'USAGE', stage: 'input', message: `Unknown option: ${a}. Run \`iconforge help\`.`, recoverable: false });
    else if (command === null) command = a;
    else throw new ForgeError({ code: 'USAGE', stage: 'input', message: `Unexpected argument: ${a}`, recoverable: false });
  }
  if (command !== null && !COMMANDS.has(command)) throw new ForgeError({ code: 'USAGE', stage: 'input', message: `Unknown command: ${command}. Run \`iconforge help\`.`, recoverable: false });
  return { command: command ?? 'help', options, showHelp, showVersion };
}

export async function runCli(argv: readonly string[], env: { cwd: string; fetchImpl?: typeof fetch; logger?: Logger; buildDeps?: BuildDeps } ): Promise<number> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    (env.logger ?? createLogger(false)).error((err as Error).message);
    return 3;
  }
  const logger = env.logger ?? createLogger(parsed.options.verbose);
  if (parsed.showVersion) {
    logger.info(ICONFORGE_VERSION);
    return 0;
  }
  if (parsed.showHelp || parsed.command === 'help') {
    logger.info(HELP_TEXT);
    return 0;
  }
  try {
    const config = await loadConfig(env.cwd);
    const ctx = createContext({ config, options: { ...parsed.options, cwd: env.cwd }, logger, ...(env.fetchImpl ? { fetchImpl: env.fetchImpl } : {}) });
    switch (parsed.command) {
      case 'build':
        return await buildCommand(ctx, env.buildDeps);
      case 'validate':
        return await validateCommand(ctx);
      case 'info':
        return await infoCommand(ctx);
      case 'clean-cache':
        return await cleanCacheCommand(ctx);
      default:
        return 3;
    }
  } catch (err) {
    logger.error((err as Error).message);
    return 3;
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runCli(process.argv.slice(2), { cwd: process.cwd() }).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      console.error(err);
      process.exitCode = 3;
    },
  );
}
