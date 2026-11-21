import { readFile } from 'node:fs/promises';
import { ForgeError } from '../core/errors.js';

export interface InputEntry {
  /** 1-based line number in the input file. */
  line: number;
  /** Trimmed text exactly as written. */
  name: string;
}

/** Parses icons.txt content: '#' lines are comments, blank lines are ignored, whitespace is trimmed. */
export function parseInputText(text: string): InputEntry[] {
  const entries: InputEntry[] = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  lines.forEach((raw, idx) => {
    const name = raw.trim();
    if (name === '' || name.startsWith('#')) return;
    entries.push({ line: idx + 1, name });
  });
  return entries;
}

export async function readInputFile(file: string): Promise<InputEntry[]> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    throw new ForgeError({
      code: code === 'ENOENT' ? 'INPUT_NOT_FOUND' : 'INPUT_READ',
      stage: 'input',
      message: code === 'ENOENT' ? `Input file not found: ${file}` : `Cannot read input file ${file}: ${(err as Error).message}`,
      recoverable: false,
    });
  }
  return parseInputText(text);
}
