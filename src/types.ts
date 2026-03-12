// ============================================================
// types.ts — Core data structures for the design language AST
// ============================================================

/** Position in source text for error reporting */
export interface SourcePos {
  line: number;   // 1-based
  col: number;    // 1-based (character index)
}

// ── Component types ────────────────────────────────────────

export type ComponentKind =
  | 'button'
  | 'text_input'
  | 'label'
  | 'radio'
  | 'checkbox'
  | 'tab'
  | 'space';

export interface Component {
  kind: ComponentKind;
  text: string;           // display text / placeholder
  checked?: boolean;      // for radio / checkbox
  /** Character width of the component in the source (including delimiters & padding) */
  charWidth: number;
  /** Variables referenced inside this component */
  variables: VariableRef[];
  /** Source position for error reporting */
  pos: SourcePos;
}

// ── Variable references ────────────────────────────────────

export interface VariableRef {
  name: string;
  isArray: boolean;   // true for {#arr}
}

// ── Layout tree ────────────────────────────────────────────

export type LayoutNodeKind = 'container' | 'row' | 'column';

export interface LayoutNode {
  kind: LayoutNodeKind;
  /** Relative width proportion (from character count) */
  widthPortion: number;
  /** Relative height proportion (from line count) */
  heightPortion: number;
  children: (LayoutNode | RowContent)[];
  /** Whether this node contains array-variable rows */
  hasArrayVar: boolean;
  /** Source position of the top-left corner */
  pos: SourcePos;
}

/** A single content row inside a layout container */
export interface RowContent {
  kind: 'row_content';
  components: Component[];
  /** Left offset in characters from the container's inner left edge */
  leftOffset: number;
  /** Whether this row contains array variables (needs repetition) */
  hasArrayVar: boolean;
  /** The array variable name driving repetition (if any) */
  arrayVarName?: string;
  /** Source line number */
  pos: SourcePos;
}

// ── Top-level parse result ─────────────────────────────────

export interface ParseResult {
  root: LayoutNode;
  /** All unique variable names found */
  variables: VariableRef[];
  /** Total character width of the design */
  totalCharWidth: number;
  /** Total line count of the design */
  totalLineHeight: number;
}

// ── Code generation context ────────────────────────────────

export interface GenContext {
  /** Base name derived from input filename (e.g. "login_page") */
  baseName: string;
  /** PascalCase name for struct/enum (e.g. "LoginPage") */
  pascalName: string;
  /** All variables */
  variables: VariableRef[];
  /** All unique array variable names */
  arrayVarNames: string[];
  /** All unique scalar variable names */
  scalarVarNames: string[];
  /** Total design width in chars */
  totalCharWidth: number;
  /** Total design height in lines */
  totalLineHeight: number;
  /** Font size baseline */
  fontSize: number;
}
