// ============================================================
// index.ts — CLI entry point
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { parse } from './parser.js';
import { generateView, resetVarCounter, toSnakeCase, toPascalCase } from './gen_view.js';
import { generateState } from './gen_state.js';
import { generateStyle } from './gen_style.js';
import { generateMain } from './gen_main.js';
import { GenContext, ParseResult, VariableRef } from './types.js';

const FONT_SIZE = 14;

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node dist/index.js <input.md>');
    console.error('');
    console.error('Generates Rust iced UI code from a text-based design language file.');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  if (!inputPath.endsWith('.md')) {
    console.error(`Error: Input file must be a .md file, got: ${inputPath}`);
    process.exit(1);
  }

  // Read input
  const input = fs.readFileSync(inputPath, 'utf-8');
  const inputDir = path.dirname(inputPath);
  const baseName = toSnakeCase(path.basename(inputPath, '.md'));
  const pascalName = toPascalCase(baseName);

  console.log(`Parsing: ${inputPath}`);
  console.log(`Base name: ${baseName} (${pascalName})`);

  // Parse
  let parseResult: ParseResult;
  try {
    parseResult = parse(input);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('');
    console.error(msg);
    process.exit(1);
  }

  console.log(`Design size: ${parseResult.totalCharWidth} chars x ${parseResult.totalLineHeight} lines`);
  console.log(`Variables found: ${parseResult.variables.map((v: VariableRef) => (v.isArray ? '{#' : '{') + v.name + '}').join(', ') || '(none)'}`);

  // Build generation context
  const scalarVarNames = parseResult.variables
    .filter((v: VariableRef) => !v.isArray)
    .map((v: VariableRef) => v.name);
  const arrayVarNames = parseResult.variables
    .filter((v: VariableRef) => v.isArray)
    .map((v: VariableRef) => v.name);

  const ctx: GenContext = {
    baseName,
    pascalName,
    variables: parseResult.variables,
    scalarVarNames,
    arrayVarNames,
    totalCharWidth: parseResult.totalCharWidth,
    totalLineHeight: parseResult.totalLineHeight,
    fontSize: FONT_SIZE,
  };

  // Generate files
  resetVarCounter();
  const viewCode = generateView(parseResult, ctx);
  const stateCode = generateState(parseResult, ctx);
  const styleCode = generateStyle(ctx);
  const mainCode = generateMain(ctx);

  // Write output files
  const viewPath = path.join(inputDir, `${baseName}.rs`);
  const statePath = path.join(inputDir, `${baseName}_state.rs`);
  const stylePath = path.join(inputDir, `style.rs`);
  const mainPath = path.join(inputDir, `main.rs`);

  fs.writeFileSync(viewPath, viewCode, 'utf-8');
  console.log(`  -> ${viewPath}`);

  fs.writeFileSync(statePath, stateCode, 'utf-8');
  console.log(`  -> ${statePath}`);

  fs.writeFileSync(stylePath, styleCode, 'utf-8');
  console.log(`  -> ${stylePath}`);

  fs.writeFileSync(mainPath, mainCode, 'utf-8');
  console.log(`  -> ${mainPath}`);

  console.log('');
  console.log('Done! Generated files:');
  console.log(`  ${baseName}.rs       - View layout code`);
  console.log(`  ${baseName}_state.rs - State struct + Message enum`);
  console.log(`  style.rs             - Theme & style definitions`);
  console.log(`  main.rs              - Launcher with example data`);
}

main();
