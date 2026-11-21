export interface Logger {
  info(msg: string): void;
  success(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
  progress(done: number, total: number, label: string): void;
}

const useColor = Boolean(process.stdout.isTTY) && !process.env['NO_COLOR'];
const c = (code: number, s: string): string => (useColor ? `\u001b[${code}m${s}\u001b[0m` : s);

export function createLogger(verbose: boolean): Logger {
  const isTty = Boolean(process.stderr.isTTY);
  return {
    info: (m) => console.log(m),
    success: (m) => console.log(c(32, `✔ ${m}`)),
    warn: (m) => console.warn(c(33, `⚠ ${m}`)),
    error: (m) => console.error(c(31, `✖ ${m}`)),
    debug: (m) => {
      if (verbose) console.log(c(90, `  · ${m}`));
    },
    progress: (done, total, label) => {
      if (verbose) {
        console.log(c(90, `  [${done}/${total}] ${label}`));
        return;
      }
      if (!isTty) return;
      process.stderr.write(`\r${`[${done}/${total}] ${label}`.padEnd(70)}`);
      if (done === total) process.stderr.write('\n');
    },
  };
}

export function createSilentLogger(): Logger {
  const noop = (): void => undefined;
  return { info: noop, success: noop, warn: noop, error: noop, debug: noop, progress: noop };
}
