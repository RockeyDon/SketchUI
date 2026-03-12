// ============================================================
// gen_state.ts — Generate the state struct + message enum .rs
// ============================================================

import {
  Component,
  GenContext,
  LayoutNode,
  ParseResult,
  RowContent,
} from './types.js';
import { toSnakeCase, escapeRust } from './gen_view.js';

/**
 * Generate the {baseName}_state.rs file containing:
 *   - State struct
 *   - Message enum
 *   - impl with new(), update()
 */
export function generateState(pr: ParseResult, ctx: GenContext): string {
  const lines: string[] = [];

  // Collect all interactive components for state fields and messages
  const inputs = collectInputs(pr.root);
  const buttons = collectButtons(pr.root);
  const radios = collectRadios(pr.root);
  const checkboxes = collectCheckboxes(pr.root);
  const tabs = collectTabs(pr.root);

  // ── Imports ──────────────────────────────────────────────
  lines.push(`use iced::Theme;`);
  lines.push(``);

  // ── Message enum ─────────────────────────────────────────
  lines.push(`#[derive(Debug, Clone)]`);
  lines.push(`pub enum ${ctx.pascalName}Message {`);
  if (buttons.length > 0) {
    lines.push(`    ButtonPressed(String),`);
  }
  if (inputs.length > 0) {
    lines.push(`    InputChanged(String, String),`);
  }
  if (radios.length > 0) {
    lines.push(`    RadioChanged(String, String),`);
  }
  if (checkboxes.length > 0) {
    lines.push(`    CheckboxToggled(String),`);
  }
  if (tabs.length > 0) {
    lines.push(`    TabChanged(String),`);
  }
  // Variable update messages
  for (const v of ctx.scalarVarNames) {
    lines.push(`    Update${toPascalCase(v)}(String),`);
  }
  for (const v of ctx.arrayVarNames) {
    lines.push(`    Update${toPascalCase(v)}(Vec<String>),`);
  }
  lines.push(`}`);
  lines.push(``);

  // ── State struct ─────────────────────────────────────────
  lines.push(`pub struct ${ctx.pascalName}State {`);
  lines.push(`    pub theme: Theme,`);

  // Scalar variables
  for (const v of ctx.scalarVarNames) {
    lines.push(`    pub ${v}: String,`);
  }

  // Array variables
  for (const v of ctx.arrayVarNames) {
    lines.push(`    pub ${v}: Vec<String>,`);
  }

  // Input fields
  for (const inp of inputs) {
    const field = getInputField(inp);
    lines.push(`    pub ${field}: String,`);
  }

  // Radio group state
  if (radios.length > 0) {
    lines.push(`    pub radio_group: String,`);
  }

  // Checkbox states
  for (const cb of checkboxes) {
    const field = toSnakeCase(cb.text);
    lines.push(`    pub ${field}_checked: bool,`);
  }

  // Tab state
  if (tabs.length > 0) {
    lines.push(`    pub active_tab: String,`);
  }

  lines.push(`}`);
  lines.push(``);

  // ── Implementation ───────────────────────────────────────
  lines.push(`impl ${ctx.pascalName}State {`);

  // new()
  lines.push(`    pub fn new() -> Self {`);
  lines.push(`        Self {`);
  lines.push(`            theme: Theme::Light,`);

  for (const v of ctx.scalarVarNames) {
    lines.push(`            ${v}: String::new(),`);
  }
  for (const v of ctx.arrayVarNames) {
    lines.push(`            ${v}: Vec::new(),`);
  }
  for (const inp of inputs) {
    const field = getInputField(inp);
    lines.push(`            ${field}: String::new(),`);
  }
  if (radios.length > 0) {
    const defaultRadio = radios.find((r) => r.checked) || radios[0];
    lines.push(`            radio_group: "${escapeRust(defaultRadio.text)}".to_string(),`);
  }
  for (const cb of checkboxes) {
    const field = toSnakeCase(cb.text);
    lines.push(`            ${field}_checked: ${cb.checked ? 'true' : 'false'},`);
  }
  if (tabs.length > 0) {
    lines.push(`            active_tab: "${escapeRust(tabs[0].text)}".to_string(),`);
  }

  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(``);

  // update()
  lines.push(`    pub fn update(&mut self, message: ${ctx.pascalName}Message) {`);
  lines.push(`        match message {`);

  if (buttons.length > 0) {
    lines.push(`            ${ctx.pascalName}Message::ButtonPressed(name) => {`);
    lines.push(`                // TODO: Handle button press for the given button name`);
    lines.push(`                println!("Button pressed: {}", name);`);
    lines.push(`            }`);
  }
  if (inputs.length > 0) {
    lines.push(`            ${ctx.pascalName}Message::InputChanged(field, value) => {`);
    lines.push(`                match field.as_str() {`);
    for (const inp of inputs) {
      const field = getInputField(inp);
      lines.push(`                    "${field}" => self.${field} = value,`);
    }
    lines.push(`                    _ => {}`);
    lines.push(`                }`);
    lines.push(`            }`);
  }
  if (radios.length > 0) {
    lines.push(`            ${ctx.pascalName}Message::RadioChanged(_group, value) => {`);
    lines.push(`                self.radio_group = value;`);
    lines.push(`            }`);
  }
  if (checkboxes.length > 0) {
    lines.push(`            ${ctx.pascalName}Message::CheckboxToggled(field) => {`);
    lines.push(`                match field.as_str() {`);
    for (const cb of checkboxes) {
      const field = toSnakeCase(cb.text);
      lines.push(`                    "${field}" => self.${field}_checked = !self.${field}_checked,`);
    }
    lines.push(`                    _ => {}`);
    lines.push(`                }`);
    lines.push(`            }`);
  }
  if (tabs.length > 0) {
    lines.push(`            ${ctx.pascalName}Message::TabChanged(tab) => {`);
    lines.push(`                self.active_tab = tab;`);
    lines.push(`            }`);
  }

  for (const v of ctx.scalarVarNames) {
    lines.push(`            ${ctx.pascalName}Message::Update${toPascalCase(v)}(val) => {`);
    lines.push(`                self.${v} = val;`);
    lines.push(`            }`);
  }
  for (const v of ctx.arrayVarNames) {
    lines.push(`            ${ctx.pascalName}Message::Update${toPascalCase(v)}(val) => {`);
    lines.push(`                self.${v} = val;`);
    lines.push(`            }`);
  }

  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(`}`);

  return lines.join('\n');
}

// ── Collectors ─────────────────────────────────────────────

function collectComponents(node: LayoutNode | RowContent, kind: string): Component[] {
  const result: Component[] = [];
  if (node.kind === 'row_content') {
    for (const comp of node.components) {
      if (comp.kind === kind) result.push(comp);
    }
  } else {
    for (const child of node.children) {
      result.push(...collectComponents(child as LayoutNode | RowContent, kind));
    }
  }
  return result;
}

function collectInputs(root: LayoutNode): Component[] {
  return deduplicateByText(collectComponents(root, 'text_input'));
}

function collectButtons(root: LayoutNode): Component[] {
  return deduplicateByText(collectComponents(root, 'button'));
}

function collectRadios(root: LayoutNode): Component[] {
  return deduplicateByText(collectComponents(root, 'radio'));
}

function collectCheckboxes(root: LayoutNode): Component[] {
  return deduplicateByText(collectComponents(root, 'checkbox'));
}

function collectTabs(root: LayoutNode): Component[] {
  return deduplicateByText(collectComponents(root, 'tab'));
}

function deduplicateByText(comps: Component[]): Component[] {
  const seen = new Set<string>();
  return comps.filter((c) => {
    if (seen.has(c.text)) return false;
    seen.add(c.text);
    return true;
  });
}

function getInputField(comp: Component): string {
  const base = toSnakeCase(comp.text.replace(/[请输入：:示例]/g, ''));
  return `input_${base || 'field'}`;
}

function toPascalCase(s: string): string {
  return s
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}
