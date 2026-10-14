import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function directFunction(node) {
  if (!node) return false;
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

function definition(node) {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isConstructorDeclaration(node)) return !!node.body;
  if (ts.isVariableStatement(node)) return node.declarationList.declarations.some((declaration) => directFunction(declaration.initializer));
  if (ts.isExportAssignment(node)) return directFunction(node.expression);
  return (ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node)) && directFunction(node.initializer);
}

/** Only whitespace between syntax nodes changes; strings, callbacks and attached comments stay intact. */
export function formatFunctionSpacing(text, filename = 'source.ts') {
  const kind = /\.tsx$/.test(filename) ? ts.ScriptKind.TSX : /\.jsx$/.test(filename) ? ts.ScriptKind.JSX : /\.(?:m|c)?js$/.test(filename) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, kind);
  const edits = new Map();
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  function siblings(nodes, parent) {
    for (let index = 1; index < nodes.length; index++) {
      const previous = nodes[index - 1];
      const next = nodes[index];
      if (!definition(previous) && !definition(next)) continue;
      // Overload signatures and their implementation form a single definition.
      const sameDefinition = (previous.name && next.name && previous.name.getText(source) === next.name.getText(source)) || (ts.isConstructorDeclaration(previous) && ts.isConstructorDeclaration(next));
      if (sameDefinition && (!previous.body || !next.body) && (ts.isFunctionDeclaration(previous) || ts.isMethodDeclaration(previous) || ts.isConstructorDeclaration(previous))) continue;
      let start = previous.end;
      if (text[start] === ',') start++;
      const comments = ts.getTrailingCommentRanges(text, start) ?? [];
      if (comments.length) start = comments.at(-1).end;
      const between = text.slice(start, next.getStart(source));
      const whitespace = between.match(/^[\t \r\n]*/)[0];
      const lines = whitespace.split(/\r?\n/);
      let indent = lines.at(-1);
      if (lines.length === 1) {
        const parentStart = parent.getStart(source);
        const line = text.slice(text.lastIndexOf('\n', parentStart - 1) + 1, parentStart);
        indent = (line.match(/^[\t ]*/)?.[0] ?? '') + (ts.isSourceFile(parent) ? '' : '  ');
      }
      const replacement = newline + newline + indent;
      if (replacement !== whitespace) edits.set(start, { end: start + whitespace.length, replacement });
    }
  }
  function visit(node) {
    if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)) siblings(node.statements, node);
    else if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) siblings(node.members, node);
    else if (ts.isObjectLiteralExpression(node)) siblings(node.properties, node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const [start, edit] of [...edits].sort(([a], [b]) => b - a)) text = text.slice(0, start) + edit.replacement + text.slice(edit.end);
  return text;
}

async function main() {
  const write = process.argv.includes('--write');
  const check = process.argv.includes('--check');
  if (write === check) throw new Error('Choose --write or --check');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const names = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0');
  const files = [...new Set(names)].filter((name) => /^(apps|packages)\//.test(name) && /\.(?:[cm]?[jt]s|[jt]sx)$/.test(name) && !/(?:^|\/)(dist|node_modules|\.next|\.turbo)\//.test(name));
  let changed = 0;
  for (const name of files) {
    const file = path.join(root, name);
    let source;
    try { source = await readFile(file, 'utf8'); } catch (error) {
      if (error.code === 'ENOENT') continue; // A tracked file may have been deleted locally.
      throw error;
    }
    const formatted = formatFunctionSpacing(source, name);
    if (source === formatted) continue;
    changed++;
    if (write) await writeFile(file, formatted);
    else console.error(`${name}: expected one blank line around function definitions`);
  }
  console.log(`Function spacing: ${changed} ${write ? 'formatted' : 'unformatted'} files`);
  if (check && changed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
