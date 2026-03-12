// ============================================================
// gen_main.ts — Generate the main.rs launcher file
// ============================================================

import { GenContext } from './types.js';
import { escapeRust } from './gen_view.js';

/**
 * Generate a main.rs that launches the generated page as a standalone app.
 * Includes hardcoded example variables for testing.
 */
export function generateMain(ctx: GenContext): string {
  // Calculate window size from design dimensions
  const charWidthPx = ctx.fontSize * 0.6;
  const lineHeightPx = ctx.fontSize * 1.8;
  const windowWidth = Math.round(ctx.totalCharWidth * charWidthPx + 40); // +padding
  const windowHeight = Math.round(ctx.totalLineHeight * lineHeightPx + 40);
  // Clamp to reasonable bounds
  const w = Math.max(400, Math.min(1600, windowWidth));
  const h = Math.max(300, Math.min(1200, windowHeight));

  const lines: string[] = [];

  lines.push(`#![cfg_attr(not(test), windows_subsystem = "windows")]`);
  lines.push(``);
  lines.push(`mod ${ctx.baseName};`);
  lines.push(`mod ${ctx.baseName}_state;`);
  lines.push(`mod style;`);
  lines.push(``);
  lines.push(`use ${ctx.baseName}_state::{${ctx.pascalName}State, ${ctx.pascalName}Message};`);
  lines.push(`use iced::{Element, Font, Task, Theme};`);
  lines.push(``);

  // Font loader
  lines.push(`fn load_system_cjk_font() -> Option<Vec<u8>> {`);
  lines.push(`    let font_path = r"C:\\Windows\\Fonts\\msyh.ttc";`);
  lines.push(`    std::fs::read(font_path).ok()`);
  lines.push(`}`);
  lines.push(``);

  // App wrapper struct
  lines.push(`struct App {`);
  lines.push(`    state: ${ctx.pascalName}State,`);
  lines.push(`}`);
  lines.push(``);

  lines.push(`impl App {`);
  lines.push(`    fn new() -> (Self, Task<${ctx.pascalName}Message>) {`);
  lines.push(`        let mut state = ${ctx.pascalName}State::new();`);
  lines.push(``);
  lines.push(`        // ── Example data: modify these to test your page ──`);

  // Generate example scalar variables
  for (const v of ctx.scalarVarNames) {
    lines.push(`        state.${v} = "示例${v}".to_string();`);
  }

  // Generate example array variables
  for (const v of ctx.arrayVarNames) {
    lines.push(`        state.${v} = vec![`);
    lines.push(`            "示例项1".to_string(),`);
    lines.push(`            "示例项2".to_string(),`);
    lines.push(`            "示例项3".to_string(),`);
    lines.push(`        ];`);
  }

  lines.push(``);
  lines.push(`        (App { state }, Task::none())`);
  lines.push(`    }`);
  lines.push(``);

  lines.push(`    fn update(&mut self, message: ${ctx.pascalName}Message) -> Task<${ctx.pascalName}Message> {`);
  lines.push(`        self.state.update(message);`);
  lines.push(`        Task::none()`);
  lines.push(`    }`);
  lines.push(``);

  lines.push(`    fn view(&self) -> Element<'_, ${ctx.pascalName}Message> {`);
  lines.push(`        ${ctx.baseName}::view(&self.state)`);
  lines.push(`    }`);
  lines.push(``);

  lines.push(`    fn theme(&self) -> Theme {`);
  lines.push(`        self.state.theme.clone()`);
  lines.push(`    }`);
  lines.push(`}`);
  lines.push(``);

  // main function
  lines.push(`fn main() -> iced::Result {`);
  lines.push(`    let mut app = iced::application(App::new, App::update, App::view)`);
  lines.push(`        .title("${ctx.pascalName}")`);
  lines.push(`        .theme(|state: &App| Some(state.theme()))`);
  lines.push(`        .window_size((${w}.0, ${h}.0));`);
  lines.push(``);
  lines.push(`    if let Some(font_data) = load_system_cjk_font() {`);
  lines.push(`        app = app`);
  lines.push(`            .font(font_data)`);
  lines.push(`            .default_font(Font::with_name("Microsoft YaHei"));`);
  lines.push(`    }`);
  lines.push(``);
  lines.push(`    app.run()`);
  lines.push(`}`);

  return lines.join('\n');
}
