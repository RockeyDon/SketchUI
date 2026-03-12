// ============================================================
// gen_view.ts — Generate the view .rs file (layout + widgets)
// ============================================================

import {
  Component,
  GenContext,
  LayoutNode,
  ParseResult,
  RowContent,
} from './types.js';

/**
 * Generate the view .rs file content.
 */
export function generateView(pr: ParseResult, ctx: GenContext): string {
  const lines: string[] = [];

  // ── Imports ──────────────────────────────────────────────
  lines.push(`use crate::${ctx.baseName}_state::{${ctx.pascalName}State, ${ctx.pascalName}Message};`);
  lines.push(`use crate::style;`);
  lines.push(``);
  lines.push(`use iced::widget::{`);
  lines.push(`    button, column, container, row, scrollable, text, text_input,`);
  lines.push(`    checkbox, radio, Column, Row, Space,`);
  lines.push(`};`);
  lines.push(`use iced::{alignment, Element, Length};`);
  lines.push(``);

  // ── View function ────────────────────────────────────────
  lines.push(`pub fn view(state: &${ctx.pascalName}State) -> Element<'_, ${ctx.pascalName}Message> {`);
  lines.push(`    let theme = &state.theme;`);
  lines.push(`    let tc = style::text_color(theme);`);
  lines.push(`    let mc = style::text_muted_color(theme);`);
  lines.push(``);

  // Generate the root layout
  const rootCode = generateNode(pr.root, ctx, 1);
  lines.push(rootCode.code);
  lines.push(``);
  lines.push(`    container(${rootCode.varName})`);
  lines.push(`        .width(Length::Fill)`);
  lines.push(`        .height(Length::Fill)`);
  lines.push(`        .style(style::app_background)`);
  lines.push(`        .into()`);
  lines.push(`}`);

  return lines.join('\n');
}

interface CodeBlock {
  code: string;
  varName: string;
}

let varCounter = 0;

function resetVarCounter(): void {
  varCounter = 0;
}

function nextVar(prefix: string = 'el'): string {
  return `${prefix}_${varCounter++}`;
}

function indent(level: number): string {
  return '    '.repeat(level);
}

function generateNode(
  node: LayoutNode | RowContent,
  ctx: GenContext,
  level: number,
): CodeBlock {
  if (node.kind === 'row_content') {
    return generateRowContent(node, ctx, level);
  }
  return generateLayoutNode(node, ctx, level);
}

function generateLayoutNode(
  node: LayoutNode,
  ctx: GenContext,
  level: number,
): CodeBlock {
  const varName = nextVar('layout');
  const ind = indent(level);
  const lines: string[] = [];

  if (node.kind === 'row') {
    // Horizontal split — children are side by side
    const childBlocks: CodeBlock[] = [];
    for (const child of node.children) {
      const cb = generateNode(child, ctx, level);
      childBlocks.push(cb);
      lines.push(cb.code);
    }

    // Calculate width portions
    const totalWidth = (node.children as LayoutNode[]).reduce(
      (sum, c) => sum + c.widthPortion, 0,
    );

    lines.push(`${ind}let ${varName} = row![`);
    for (let i = 0; i < childBlocks.length; i++) {
      const child = node.children[i] as LayoutNode;
      const portion = Math.max(1, Math.round((child.widthPortion / totalWidth) * 10));
      lines.push(`${ind}    container(${childBlocks[i].varName})`);
      lines.push(`${ind}        .width(Length::FillPortion(${portion}))`);
      lines.push(`${ind}        .height(Length::Fill),`);
    }
    lines.push(`${ind}]`);
    lines.push(`${ind}.width(Length::Fill)`);
    lines.push(`${ind}.height(Length::Fill);`);

  } else if (node.kind === 'column') {
    // Vertical split — children are stacked
    const childBlocks: CodeBlock[] = [];
    for (const child of node.children) {
      const cb = generateNode(child, ctx, level);
      childBlocks.push(cb);
      lines.push(cb.code);
    }

    const totalHeight = (node.children as LayoutNode[]).reduce(
      (sum, c) => sum + c.heightPortion, 0,
    );

    lines.push(`${ind}let ${varName} = column![`);
    for (let i = 0; i < childBlocks.length; i++) {
      const child = node.children[i] as LayoutNode;
      const portion = Math.max(1, Math.round((child.heightPortion / totalHeight) * 10));
      lines.push(`${ind}    container(${childBlocks[i].varName})`);
      lines.push(`${ind}        .width(Length::Fill)`);
      lines.push(`${ind}        .height(Length::FillPortion(${portion})),`);
    }
    lines.push(`${ind}]`);
    lines.push(`${ind}.width(Length::Fill)`);
    lines.push(`${ind}.height(Length::Fill);`);

  } else {
    // Container — leaf node with content rows
    const childBlocks: CodeBlock[] = [];
    // Separate array-var rows from static rows
    const arrayGroups = groupArrayRows(node.children);

    for (const group of arrayGroups) {
      if (group.isArray) {
        const cb = generateArrayGroup(group.rows as RowContent[], ctx, level);
        childBlocks.push(cb);
        lines.push(cb.code);
      } else {
        for (const child of group.rows) {
          const cb = generateNode(child, ctx, level);
          childBlocks.push(cb);
          lines.push(cb.code);
        }
      }
    }

    if (childBlocks.length === 0) {
      lines.push(`${ind}let ${varName} = Space::new().width(Length::Fill).height(Length::Fill);`);
    } else {
      lines.push(`${ind}let ${varName} = column![`);
      for (const cb of childBlocks) {
        lines.push(`${ind}    ${cb.varName},`);
      }
      lines.push(`${ind}]`);
      lines.push(`${ind}.width(Length::Fill)`);
      lines.push(`${ind}.height(Length::Fill);`);
    }
  }

  return { code: lines.join('\n'), varName };
}

interface ArrayGroup {
  isArray: boolean;
  arrayVarName?: string;
  rows: (LayoutNode | RowContent)[];
}

function groupArrayRows(children: (LayoutNode | RowContent)[]): ArrayGroup[] {
  const groups: ArrayGroup[] = [];
  let current: ArrayGroup | null = null;

  for (const child of children) {
    const isArr = child.kind === 'row_content' && child.hasArrayVar;
    const arrName = child.kind === 'row_content' ? child.arrayVarName : undefined;

    if (isArr) {
      if (current && current.isArray && current.arrayVarName === arrName) {
        current.rows.push(child);
      } else {
        if (current) groups.push(current);
        current = { isArray: true, arrayVarName: arrName, rows: [child] };
      }
    } else {
      if (current && !current.isArray) {
        current.rows.push(child);
      } else {
        if (current) groups.push(current);
        current = { isArray: false, rows: [child] };
      }
    }
  }
  if (current) groups.push(current);
  return groups;
}

function generateArrayGroup(
  rows: RowContent[],
  ctx: GenContext,
  level: number,
): CodeBlock {
  const varName = nextVar('arr_section');
  const ind = indent(level);
  const arrVarName = rows[0].arrayVarName!;
  const lines: string[] = [];

  // Generate the repeated row template inside a for loop
  lines.push(`${ind}let ${varName} = {`);
  lines.push(`${ind}    let mut col = Column::new().spacing(0);`);
  lines.push(`${ind}    for (idx, item) in state.${arrVarName}.iter().enumerate() {`);

  // Generate each row in the group
  for (const row of rows) {
    const rowCode = generateRowContentForArray(row, ctx, level + 2, arrVarName);
    lines.push(rowCode.code);
    lines.push(`${ind}        col = col.push(${rowCode.varName});`);
  }

  lines.push(`${ind}    }`);
  lines.push(`${ind}    scrollable(col).width(Length::Fill)`);
  lines.push(`${ind}};`);

  return { code: lines.join('\n'), varName };
}

function generateRowContent(
  row: RowContent,
  ctx: GenContext,
  level: number,
): CodeBlock {
  const varName = nextVar('row');
  const ind = indent(level);
  const lines: string[] = [];

  const widgetCodes: CodeBlock[] = [];
  for (const comp of row.components) {
    if (comp.kind === 'space') continue; // spaces handled via spacing/padding
    const wc = generateWidget(comp, ctx, level, false, undefined);
    widgetCodes.push(wc);
    if (wc.code) lines.push(wc.code);
  }

  if (widgetCodes.length === 0) {
    lines.push(`${ind}let ${varName} = Space::new().height(${ctx.fontSize});`);
  } else if (widgetCodes.length === 1) {
    const leftPad = Math.round(row.leftOffset * ctx.fontSize * 0.6);
    lines.push(`${ind}let ${varName} = container(${widgetCodes[0].varName})`);
    lines.push(`${ind}    .padding([0, 0, 0, ${leftPad}])`);
    lines.push(`${ind}    .width(Length::Fill);`);
  } else {
    const leftPad = Math.round(row.leftOffset * ctx.fontSize * 0.6);
    lines.push(`${ind}let ${varName} = container(`);
    lines.push(`${ind}    row![`);
    for (const wc of widgetCodes) {
      lines.push(`${ind}        ${wc.varName},`);
    }
    lines.push(`${ind}    ]`);
    lines.push(`${ind}    .spacing(${Math.round(ctx.fontSize * 0.5)})`);
    lines.push(`${ind}    .align_y(alignment::Vertical::Center)`);
    lines.push(`${ind})`);
    lines.push(`${ind}.padding([0, 0, 0, ${leftPad}])`);
    lines.push(`${ind}.width(Length::Fill);`);
  }

  return { code: lines.join('\n'), varName };
}

function generateRowContentForArray(
  row: RowContent,
  ctx: GenContext,
  level: number,
  arrVarName: string,
): CodeBlock {
  const varName = nextVar('arr_row');
  const ind = indent(level);
  const lines: string[] = [];

  const widgetCodes: CodeBlock[] = [];
  for (const comp of row.components) {
    if (comp.kind === 'space') continue;
    const wc = generateWidget(comp, ctx, level, true, arrVarName);
    widgetCodes.push(wc);
    if (wc.code) lines.push(wc.code);
  }

  if (widgetCodes.length === 0) {
    lines.push(`${ind}let ${varName} = Space::new().height(${ctx.fontSize});`);
  } else {
    const leftPad = Math.round(row.leftOffset * ctx.fontSize * 0.6);
    lines.push(`${ind}let ${varName} = container(`);
    lines.push(`${ind}    row![`);
    for (const wc of widgetCodes) {
      lines.push(`${ind}        ${wc.varName},`);
    }
    lines.push(`${ind}    ]`);
    lines.push(`${ind}    .spacing(${Math.round(ctx.fontSize * 0.5)})`);
    lines.push(`${ind}    .align_y(alignment::Vertical::Center)`);
    lines.push(`${ind})`);
    lines.push(`${ind}.padding([0, 0, 0, ${leftPad}])`);
    lines.push(`${ind}.width(Length::Fill);`);
  }

  return { code: lines.join('\n'), varName };
}

function generateWidget(
  comp: Component,
  ctx: GenContext,
  level: number,
  inArray: boolean,
  arrVarName?: string,
): CodeBlock {
  const ind = indent(level);
  const varName = nextVar('w');
  const lines: string[] = [];
  const textExpr = resolveTextExpr(comp.text, ctx, inArray, arrVarName);
  const widthPx = Math.round(comp.charWidth * ctx.fontSize * 0.6);

  switch (comp.kind) {
    case 'button': {
      lines.push(`${ind}let ${varName} = button(`);
      lines.push(`${ind}    text(${textExpr})`);
      lines.push(`${ind}        .size(${ctx.fontSize})`);
      lines.push(`${ind}        .align_x(alignment::Horizontal::Center)`);
      lines.push(`${ind})`);
      lines.push(`${ind}.on_press(${ctx.pascalName}Message::ButtonPressed("${escapeRust(comp.text)}".to_string()))`);
      lines.push(`${ind}.padding([${Math.round(ctx.fontSize * 0.5)}, ${Math.round(ctx.fontSize * 1.2)}])`);
      lines.push(`${ind}.style(style::btn_primary);`);
      break;
    }
    case 'text_input': {
      const stateField = getInputStateField(comp.text, ctx);
      lines.push(`${ind}let ${varName} = container(`);
      lines.push(`${ind}    text_input("${escapeRust(comp.text)}", &state.${stateField})`);
      lines.push(`${ind}        .on_input(|val| ${ctx.pascalName}Message::InputChanged("${stateField}".to_string(), val))`);
      lines.push(`${ind}        .padding([${Math.round(ctx.fontSize * 0.7)}, ${Math.round(ctx.fontSize * 0.8)}])`);
      lines.push(`${ind}        .size(${ctx.fontSize})`);
      lines.push(`${ind}        .style(style::input_style)`);
      lines.push(`${ind})`);
      lines.push(`${ind}.width(${widthPx > 0 ? widthPx : 'Length::Fill'});`);
      break;
    }
    case 'label': {
      lines.push(`${ind}let ${varName} = text(${textExpr})`);
      lines.push(`${ind}    .size(${ctx.fontSize})`);
      lines.push(`${ind}    .color(tc);`);
      break;
    }
    case 'radio': {
      const groupName = findRadioGroup(comp, ctx);
      lines.push(`${ind}let ${varName} = radio(`);
      lines.push(`${ind}    ${textExpr},`);
      lines.push(`${ind}    "${escapeRust(comp.text)}",`);
      lines.push(`${ind}    Some(&state.${groupName}),`);
      lines.push(`${ind}    |_| ${ctx.pascalName}Message::RadioChanged("${groupName}".to_string(), "${escapeRust(comp.text)}".to_string()),`);
      lines.push(`${ind})`);
      lines.push(`${ind}.size(${Math.round(ctx.fontSize * 1.2)});`);
      break;
    }
    case 'checkbox': {
      const fieldName = toSnakeCase(comp.text);
      lines.push(`${ind}let ${varName} = checkbox(state.${fieldName}_checked)`);
      lines.push(`${ind}    .on_toggle(|_| ${ctx.pascalName}Message::CheckboxToggled("${fieldName}".to_string()))`);
      lines.push(`${ind}    .size(${Math.round(ctx.fontSize * 1.2)});`);
      break;
    }
    case 'tab': {
      lines.push(`${ind}let ${varName} = button(`);
      lines.push(`${ind}    text(${textExpr})`);
      lines.push(`${ind}        .size(${ctx.fontSize})`);
      lines.push(`${ind}        .align_x(alignment::Horizontal::Center)`);
      lines.push(`${ind})`);
      lines.push(`${ind}.on_press(${ctx.pascalName}Message::TabChanged("${escapeRust(comp.text)}".to_string()))`);
      lines.push(`${ind}.padding([${Math.round(ctx.fontSize * 0.7)}, ${Math.round(ctx.fontSize * 1.5)}])`);
      lines.push(`${ind}.style(if state.active_tab == "${escapeRust(comp.text)}" {`);
      lines.push(`${ind}    style::btn_tab_active as fn(&iced::Theme, iced::widget::button::Status) -> iced::widget::button::Style`);
      lines.push(`${ind}} else {`);
      lines.push(`${ind}    style::btn_tab_inactive`);
      lines.push(`${ind}});`);
      break;
    }
    default:
      lines.push(`${ind}let ${varName} = Space::new().width(0);`);
  }

  return { code: lines.join('\n'), varName };
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Resolve text that may contain {var} or {#arr} references
 * into a Rust expression.
 */
function resolveTextExpr(
  text: string,
  ctx: GenContext,
  inArray: boolean,
  arrVarName?: string,
): string {
  const hasVar = /\{#?[a-zA-Z_]\w*\}/.test(text);
  if (!hasVar) {
    return `"${escapeRust(text)}"`;
  }

  // Build a format! expression
  let fmtStr = text;
  const args: string[] = [];

  // Replace array vars first
  fmtStr = fmtStr.replace(/\{#([a-zA-Z_]\w*)\}/g, (_match, name) => {
    if (inArray && name === arrVarName) {
      args.push('item');
    } else {
      args.push(`state.${name}.get(idx).map(|s| s.as_str()).unwrap_or("")`);
    }
    return '{}';
  });

  // Replace scalar vars
  fmtStr = fmtStr.replace(/\{([a-zA-Z_]\w*)\}/g, (_match, name) => {
    args.push(`state.${name}`);
    return '{}';
  });

  if (args.length === 0) {
    return `"${escapeRust(text)}"`;
  }

  return `format!("${escapeRust(fmtStr)}", ${args.join(', ')})`;
}

function escapeRust(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function toSnakeCase(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/^_+|_+$/g, '')
    || 'field';
}

function toPascalCase(s: string): string {
  return s
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function getInputStateField(placeholder: string, ctx: GenContext): string {
  // Generate a field name from the placeholder text
  const base = toSnakeCase(placeholder.replace(/[请输入：:]/g, ''));
  return `input_${base || 'field'}`;
}

function findRadioGroup(comp: Component, ctx: GenContext): string {
  return `radio_group`;
}

export { resetVarCounter, toSnakeCase, toPascalCase, escapeRust };
