// ============================================================
// errors.ts — Detailed error reporting
// ============================================================

import { SourcePos } from './types.js';

export class ParseError extends Error {
  constructor(
    message: string,
    public pos: SourcePos,
    public sourceLine?: string,
  ) {
    const loc = `line ${pos.line}, col ${pos.col}`;
    const detail = sourceLine
      ? `\n  | ${sourceLine}\n  | ${' '.repeat(Math.max(0, pos.col - 1))}^`
      : '';
    super(`Parse error at ${loc}: ${message}${detail}`);
    this.name = 'ParseError';
  }
}

export class GenerateError extends Error {
  constructor(message: string) {
    super(`Code generation error: ${message}`);
    this.name = 'GenerateError';
  }
}

export function formatErrors(errors: Error[]): string {
  return errors.map((e) => e.message).join('\n\n');
}
