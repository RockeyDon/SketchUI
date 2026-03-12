// ============================================================
// parser.ts — Parse text-based design language into layout tree
// ============================================================
//
// The parser works in two phases:
//   1. Grid extraction: find box-drawing rectangles (nested)
//   2. Content parsing: identify components inside each cell
//
// IMPORTANT: The grid is column-based (display-width-aware).
// CJK characters occupy 2 columns. The grid uses expandToColumns()
// so that column indices correspond to visual positions.

import {
  Component,
  LayoutNode,
  ParseResult,
  RowContent,
  SourcePos,
  VariableRef,
} from './types.js';
import { ParseError } from './errors.js';
import { expandToColumns, columnsToString } from './charwidth.js';

// ── Character classification ───────────────────────────────

const CORNER_TL = '┌';
const CORNER_TR = '┐';
const CORNER_BL = '└';
const CORNER_BR = '┘';
const H_LINE = '─';
const V_LINE = '│';
const T_DOWN = '┬';
const T_UP = '┴';
const T_RIGHT = '├';
const T_LEFT = '┤';
const CROSS = '┼';

function isHorizontal(ch: string): boolean {
  return ch === H_LINE || ch === T_DOWN || ch === T_UP || ch === CROSS;
}

function isVertical(ch: string): boolean {
  return ch === V_LINE || ch === T_RIGHT || ch === T_LEFT || ch === CROSS;
}

function isTopLeft(ch: string): boolean {
  return ch === CORNER_TL || ch === T_DOWN || ch === T_RIGHT || ch === CROSS;
}

function isTopRight(ch: string): boolean {
  return ch === CORNER_TR || ch === T_DOWN || ch === T_LEFT || ch === CROSS;
}

function isBottomLeft(ch: string): boolean {
  return ch === CORNER_BL || ch === T_UP || ch === T_RIGHT || ch === CROSS;
}

function isBottomRight(ch: string): boolean {
  return ch === CORNER_BR || ch === T_UP || ch === T_LEFT || ch === CROSS;
}

function isBoxChar(ch: string): boolean {
  return ch === CORNER_TL || ch === CORNER_TR || ch === CORNER_BL || ch === CORNER_BR ||
    ch === H_LINE || ch === V_LINE || ch === T_DOWN || ch === T_UP ||
    ch === T_RIGHT || ch === T_LEFT || ch === CROSS;
}

// ── Grid helpers ───────────────────────────────────────────

/** Build a display-width-aware 2D column grid */
function buildGrid(lines: string[]): string[][] {
  const grid = lines.map((line) => expandToColumns(line));
  const maxLen = Math.max(...grid.map((r) => r.length), 0);
  for (const row of grid) {
    while (row.length < maxLen) row.push(' ');
  }
  return grid;
}

function charAt(grid: string[][], row: number, col: number): string {
  if (row < 0 || row >= grid.length) return ' ';
  if (col < 0 || col >= grid[row].length) return ' ';
  const ch = grid[row][col];
  return ch === '\x00' ? ' ' : ch; // placeholder counts as space
}

// ── Rectangle detection ────────────────────────────────────

interface Rect {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/**
 * Starting from a top-left corner at (row, col), trace the rectangle.
 */
function traceRect(grid: string[][], row: number, col: number): Rect | null {
  if (!isTopLeft(charAt(grid, row, col))) return null;

  // Trace top edge rightward
  let right = col + 1;
  while (right < grid[row].length && isHorizontal(charAt(grid, row, right))) {
    right++;
  }
  if (right >= grid[row].length || !isTopRight(charAt(grid, row, right))) return null;

  // Trace right edge downward
  let bottom = row + 1;
  while (bottom < grid.length && isVertical(charAt(grid, bottom, right))) {
    bottom++;
  }
  if (bottom >= grid.length || !isBottomRight(charAt(grid, bottom, right))) return null;

  // Verify bottom edge
  for (let c = col + 1; c < right; c++) {
    const ch = charAt(grid, bottom, c);
    if (!isHorizontal(ch) && !isTopLeft(ch) && !isTopRight(ch) &&
        !isBottomLeft(ch) && !isBottomRight(ch) &&
        ch !== T_DOWN && ch !== T_UP && ch !== CROSS) {
      return null;
    }
  }

  // Verify left edge
  for (let r = row + 1; r < bottom; r++) {
    const ch = charAt(grid, r, col);
    if (!isVertical(ch) && !isTopLeft(ch) && !isBottomLeft(ch) &&
        ch !== T_RIGHT && ch !== CROSS) {
      return null;
    }
  }

  return { top: row, left: col, bottom, right };
}

// ── Split detection ────────────────────────────────────────

function findHSplits(grid: string[][], rect: Rect): number[] {
  const splits: number[] = [];
  for (let r = rect.top + 1; r < rect.bottom; r++) {
    const leftCh = charAt(grid, r, rect.left);
    const rightCh = charAt(grid, r, rect.right);
    if ((leftCh === T_RIGHT || leftCh === CROSS) &&
        (rightCh === T_LEFT || rightCh === CROSS)) {
      let valid = true;
      for (let c = rect.left + 1; c < rect.right; c++) {
        const ch = charAt(grid, r, c);
        if (!isHorizontal(ch) && ch !== CROSS && ch !== T_DOWN && ch !== T_UP) {
          valid = false;
          break;
        }
      }
      if (valid) splits.push(r);
    }
  }
  return splits;
}

function findVSplits(grid: string[][], rect: Rect): number[] {
  const splits: number[] = [];
  for (let c = rect.left + 1; c < rect.right; c++) {
    const topCh = charAt(grid, rect.top, c);
    const botCh = charAt(grid, rect.bottom, c);
    if ((topCh === T_DOWN || topCh === CROSS) &&
        (botCh === T_UP || botCh === CROSS)) {
      let valid = true;
      for (let r = rect.top + 1; r < rect.bottom; r++) {
        const ch = charAt(grid, r, c);
        if (!isVertical(ch) && ch !== CROSS && ch !== T_RIGHT && ch !== T_LEFT) {
          valid = false;
          break;
        }
      }
      if (valid) splits.push(c);
    }
  }
  return splits;
}

// ── Component parsing ──────────────────────────────────────

const VAR_RE = /\{([a-zA-Z_]\w*)\}/g;
const ARR_VAR_RE = /\{#([a-zA-Z_]\w*)\}/g;

function extractVariables(text: string): VariableRef[] {
  const vars: VariableRef[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(ARR_VAR_RE)) {
    const name = m[1];
    if (!seen.has('#' + name)) {
      vars.push({ name, isArray: true });
      seen.add('#' + name);
    }
  }

  for (const m of text.matchAll(VAR_RE)) {
    const name = m[1];
    if (!seen.has(name) && !seen.has('#' + name)) {
      vars.push({ name, isArray: false });
      seen.add(name);
    }
  }

  return vars;
}

/**
 * Parse a line of text content into components.
 */
function parseComponents(line: string, lineNum: number): Component[] {
  const components: Component[] = [];
  let i = 0;
  const len = line.length;

  while (i < len) {
    const startCol = i + 1;

    // Skip box-drawing chars that might leak in
    if (isBoxChar(line[i])) {
      i++;
      continue;
    }

    // Try [[ tab ]]
    if (line[i] === '[' && i + 1 < len && line[i + 1] === '[') {
      const closeIdx = line.indexOf(']]', i + 2);
      if (closeIdx >= 0) {
        const inner = line.substring(i + 2, closeIdx);
        const fullLen = closeIdx + 2 - i;
        components.push({
          kind: 'tab',
          text: inner.trim(),
          charWidth: fullLen,
          variables: extractVariables(inner),
          pos: { line: lineNum, col: startCol },
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // Try [╳] or [ ] checkbox — must be exactly 3 chars: [ ], [╳], [x], [X]
    if (line[i] === '[' && i + 2 < len && line[i + 2] === ']') {
      const inner = line[i + 1];
      if (inner === '╳' || inner === 'x' || inner === 'X' || inner === ' ') {
        // Peek ahead: if followed by space+text (not another bracket), it's a checkbox
        const afterBracket = i + 3;
        if (afterBracket < len && line[afterBracket] === ' ') {
          const checked = inner !== ' ';
          i = afterBracket + 1; // skip the space after ]
          let label = '';
          while (i < len && !isComponentStartAt(line, i)) {
            label += line[i];
            i++;
          }
          const trimLabel = label.trimEnd();
          if (trimLabel.length > 0) {
            components.push({
              kind: 'checkbox',
              text: trimLabel,
              checked,
              charWidth: 4 + label.length,
              variables: extractVariables(trimLabel),
              pos: { line: lineNum, col: startCol },
            });
            continue;
          }
          // If no label, fall through to button parsing
          i = startCol - 1;
        }
      }
    }

    // Try [ button ]
    if (line[i] === '[') {
      const closeIdx = line.indexOf(']', i + 1);
      if (closeIdx > i + 1) {
        const inner = line.substring(i + 1, closeIdx);
        // Make sure it's not a checkbox pattern
        if (closeIdx - i !== 2 || (inner !== '╳' && inner !== 'x' && inner !== 'X' && inner !== ' ')) {
          components.push({
            kind: 'button',
            text: inner.trim(),
            charWidth: closeIdx + 1 - i,
            variables: extractVariables(inner),
            pos: { line: lineNum, col: startCol },
          });
          i = closeIdx + 1;
          continue;
        }
      }
    }

    // Try < input >
    if (line[i] === '<') {
      const closeIdx = line.indexOf('>', i + 1);
      if (closeIdx > i) {
        const inner = line.substring(i + 1, closeIdx);
        components.push({
          kind: 'text_input',
          text: inner.trim(),
          charWidth: closeIdx + 1 - i,
          variables: extractVariables(inner),
          pos: { line: lineNum, col: startCol },
        });
        i = closeIdx + 1;
        continue;
      }
    }

    // Try (╳) or ( ) radio
    if (line[i] === '(' && i + 2 < len && line[i + 2] === ')') {
      const inner = line[i + 1];
      if (inner === '╳' || inner === 'x' || inner === 'X' || inner === ' ') {
        const checked = inner !== ' ';
        i += 3;
        // Skip one space after )
        if (i < len && line[i] === ' ') i++;
        let label = '';
        while (i < len && !isComponentStartAt(line, i)) {
          label += line[i];
          i++;
        }
        const trimLabel = label.trimEnd();
        if (trimLabel.length > 0) {
          components.push({
            kind: 'radio',
            text: trimLabel,
            checked,
            charWidth: 4 + label.length,
            variables: extractVariables(trimLabel),
            pos: { line: lineNum, col: startCol },
          });
          continue;
        }
      }
    }

    // Spaces — for positioning
    if (line[i] === ' ') {
      let spaceCount = 0;
      while (i < len && line[i] === ' ') {
        spaceCount++;
        i++;
      }
      if (spaceCount > 0) {
        components.push({
          kind: 'space',
          text: '',
          charWidth: spaceCount,
          variables: [],
          pos: { line: lineNum, col: startCol },
        });
      }
      continue;
    }

    // Text label
    {
      let label = '';
      const labelStart = i;
      while (i < len && !isComponentStartAt(line, i) && line[i] !== ' ') {
        label += line[i];
        i++;
      }
      // Include internal spaces that are part of the label
      while (i < len) {
        if (line[i] === ' ') {
          // Look ahead: if next non-space is not a component start, include
          let j = i;
          while (j < len && line[j] === ' ') j++;
          if (j < len && !isComponentStartAt(line, j) && !isBoxChar(line[j])) {
            while (i < j) {
              label += line[i];
              i++;
            }
            continue;
          }
          break;
        }
        if (isComponentStartAt(line, i)) break;
        label += line[i];
        i++;
      }
      if (label.length > 0) {
        components.push({
          kind: 'label',
          text: label,
          charWidth: i - labelStart,
          variables: extractVariables(label),
          pos: { line: lineNum, col: startCol },
        });
      }
    }
  }

  return components;
}

function isComponentStartAt(line: string, i: number): boolean {
  if (i >= line.length) return false;
  const ch = line[i];
  if (ch === '<') return true;
  if (ch === '[') return true; // button, checkbox, or tab
  if (ch === '(' && i + 2 < line.length && line[i + 2] === ')') return true;
  return false;
}

// ── Main parser ────────────────────────────────────────────

export function parse(input: string): ParseResult {
  const rawLines = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let lines = rawLines;
  while (lines.length > 0 && lines[0].trim() === '') lines = lines.slice(1);
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines = lines.slice(0, -1);

  if (lines.length === 0) {
    throw new ParseError('Input is empty', { line: 1, col: 1 });
  }

  const grid = buildGrid(lines);

  // Find the outermost rectangle
  const outerRect = findOuterRect(grid);
  if (!outerRect) {
    throw new ParseError(
      'Could not find a valid outermost box-drawing rectangle',
      { line: 1, col: 1 },
    );
  }

  const allVars: VariableRef[] = [];
  const root = parseRect(grid, outerRect, lines, allVars);

  // Deduplicate variables
  const seen = new Set<string>();
  const uniqueVars: VariableRef[] = [];
  for (const v of allVars) {
    const key = (v.isArray ? '#' : '') + v.name;
    if (!seen.has(key)) {
      uniqueVars.push(v);
      seen.add(key);
    }
  }

  return {
    root,
    variables: uniqueVars,
    totalCharWidth: outerRect.right - outerRect.left + 1,
    totalLineHeight: outerRect.bottom - outerRect.top + 1,
  };
}

function findOuterRect(grid: string[][]): Rect | null {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (charAt(grid, r, c) === CORNER_TL) {
        const rect = traceRect(grid, r, c);
        if (rect) return rect;
      }
    }
  }
  return null;
}

function parseRect(
  grid: string[][],
  rect: Rect,
  lines: string[],
  allVars: VariableRef[],
): LayoutNode {
  const width = rect.right - rect.left + 1;
  const height = rect.bottom - rect.top + 1;

  // Check for vertical splits (columns)
  const vSplits = findVSplits(grid, rect);
  if (vSplits.length > 0) {
    const cols = [rect.left, ...vSplits, rect.right];
    const children: LayoutNode[] = [];
    for (let i = 0; i < cols.length - 1; i++) {
      const subRect: Rect = {
        top: rect.top,
        left: cols[i],
        bottom: rect.bottom,
        right: cols[i + 1],
      };
      children.push(parseRect(grid, subRect, lines, allVars));
    }
    return {
      kind: 'row',
      widthPortion: width,
      heightPortion: height,
      children,
      hasArrayVar: children.some((c) => c.hasArrayVar),
      pos: { line: rect.top + 1, col: rect.left + 1 },
    };
  }

  // Check for horizontal splits (rows)
  const hSplits = findHSplits(grid, rect);
  if (hSplits.length > 0) {
    const rows = [rect.top, ...hSplits, rect.bottom];
    const children: LayoutNode[] = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const subRect: Rect = {
        top: rows[i],
        left: rect.left,
        bottom: rows[i + 1],
        right: rect.right,
      };
      children.push(parseRect(grid, subRect, lines, allVars));
    }
    return {
      kind: 'column',
      widthPortion: width,
      heightPortion: height,
      children,
      hasArrayVar: children.some((c) => c.hasArrayVar),
      pos: { line: rect.top + 1, col: rect.left + 1 },
    };
  }

  // Leaf container — parse content lines
  const contentRows: (LayoutNode | RowContent)[] = [];
  let hasArr = false;

  for (let r = rect.top + 1; r < rect.bottom; r++) {
    const innerLeft = rect.left + 1;
    const innerRight = rect.right;

    // Check for nested rectangle on this line
    const nestedRect = findNestedRect(grid, r, innerLeft, innerRight);
    if (nestedRect) {
      const nested = parseRect(grid, nestedRect, lines, allVars);
      contentRows.push(nested);
      if (nested.hasArrayVar) hasArr = true;
      r = nestedRect.bottom;
      continue;
    }

    // Extract content string from the original line (not the grid)
    // We need the text between the vertical borders
    const contentStr = columnsToString(grid[r], innerLeft, innerRight);

    if (contentStr.trim() === '') continue;

    const components = parseComponents(contentStr, r + 1);
    if (components.length === 0) continue;

    // Collect variables
    const rowVars: VariableRef[] = [];
    for (const comp of components) {
      for (const v of comp.variables) {
        rowVars.push(v);
        allVars.push(v);
      }
    }

    const rowHasArr = rowVars.some((v) => v.isArray);
    if (rowHasArr) hasArr = true;

    const arrVarName = rowVars.find((v) => v.isArray)?.name;

    let leftOffset = 0;
    if (components.length > 0 && components[0].kind === 'space') {
      leftOffset = components[0].charWidth;
    }

    contentRows.push({
      kind: 'row_content',
      components,
      leftOffset,
      hasArrayVar: rowHasArr,
      arrayVarName: arrVarName,
      pos: { line: r + 1, col: innerLeft + 1 },
    });
  }

  return {
    kind: 'container',
    widthPortion: width,
    heightPortion: height,
    children: contentRows,
    hasArrayVar: hasArr,
    pos: { line: rect.top + 1, col: rect.left + 1 },
  };
}

function findNestedRect(
  grid: string[][],
  row: number,
  innerLeft: number,
  innerRight: number,
): Rect | null {
  for (let c = innerLeft; c < innerRight; c++) {
    if (charAt(grid, row, c) === CORNER_TL) {
      const rect = traceRect(grid, row, c);
      if (rect && rect.right <= innerRight) {
        return rect;
      }
    }
  }
  return null;
}
