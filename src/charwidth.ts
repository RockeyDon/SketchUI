// ============================================================
// charwidth.ts — Character display width utilities
// ============================================================
//
// CJK characters and fullwidth forms occupy 2 columns in a
// monospace terminal / text editor. This module provides
// display-width-aware string operations for grid alignment.

/**
 * Get the display width of a single character.
 * CJK Unified Ideographs, fullwidth forms, etc. return 2.
 * Most other characters return 1.
 */
export function charDisplayWidth(ch: string): number {
  const code = ch.codePointAt(0);
  if (code === undefined) return 0;

  // Common ASCII fast path
  if (code < 0x7F) return 1;

  // Fullwidth and wide characters
  if (
    // CJK Unified Ideographs
    (code >= 0x4E00 && code <= 0x9FFF) ||
    // CJK Unified Ideographs Extension A
    (code >= 0x3400 && code <= 0x4DBF) ||
    // CJK Compatibility Ideographs
    (code >= 0xF900 && code <= 0xFAFF) ||
    // CJK Unified Ideographs Extension B-F
    (code >= 0x20000 && code <= 0x2FA1F) ||
    // Fullwidth Forms
    (code >= 0xFF01 && code <= 0xFF60) ||
    (code >= 0xFFE0 && code <= 0xFFE6) ||
    // CJK Radicals Supplement
    (code >= 0x2E80 && code <= 0x2EFF) ||
    // Kangxi Radicals
    (code >= 0x2F00 && code <= 0x2FDF) ||
    // CJK Symbols and Punctuation
    (code >= 0x3000 && code <= 0x303F) ||
    // Hiragana
    (code >= 0x3040 && code <= 0x309F) ||
    // Katakana
    (code >= 0x30A0 && code <= 0x30FF) ||
    // Bopomofo
    (code >= 0x3100 && code <= 0x312F) ||
    // Hangul Compatibility Jamo
    (code >= 0x3130 && code <= 0x318F) ||
    // Kanbun
    (code >= 0x3190 && code <= 0x319F) ||
    // Bopomofo Extended
    (code >= 0x31A0 && code <= 0x31BF) ||
    // CJK Strokes
    (code >= 0x31C0 && code <= 0x31EF) ||
    // Katakana Phonetic Extensions
    (code >= 0x31F0 && code <= 0x31FF) ||
    // Enclosed CJK Letters and Months
    (code >= 0x3200 && code <= 0x32FF) ||
    // CJK Compatibility
    (code >= 0x3300 && code <= 0x33FF) ||
    // Hangul Syllables
    (code >= 0xAC00 && code <= 0xD7AF) ||
    // CJK Compatibility Ideographs Supplement
    (code >= 0x2F800 && code <= 0x2FA1F) ||
    // Enclosed Ideographic Supplement
    (code >= 0x1F200 && code <= 0x1F2FF)
  ) {
    return 2;
  }

  // Box-drawing characters are width 1
  if (code >= 0x2500 && code <= 0x257F) return 1;

  return 1;
}

/**
 * Get the total display width of a string.
 */
export function stringDisplayWidth(s: string): number {
  let width = 0;
  for (const ch of s) {
    width += charDisplayWidth(ch);
  }
  return width;
}

/**
 * Expand a string into a display-width-aware column array.
 * Each element in the returned array represents one display column.
 * Wide characters occupy two consecutive slots: the character itself
 * in the first slot, and a special placeholder '\x00' in the second.
 */
export function expandToColumns(s: string): string[] {
  const cols: string[] = [];
  for (const ch of s) {
    const w = charDisplayWidth(ch);
    cols.push(ch);
    for (let i = 1; i < w; i++) {
      cols.push('\x00'); // placeholder for the second column of a wide char
    }
  }
  return cols;
}

/**
 * Extract the original text from a column range [start, end).
 * Skips placeholder '\x00' entries and reconstructs the string.
 */
export function columnsToString(cols: string[], start: number, end: number): string {
  let result = '';
  for (let i = start; i < end && i < cols.length; i++) {
    if (cols[i] !== '\x00') {
      result += cols[i];
    }
  }
  return result;
}
