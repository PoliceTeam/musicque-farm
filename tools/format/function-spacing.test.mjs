import assert from 'node:assert/strict';
import test from 'node:test';
import { formatFunctionSpacing } from './function-spacing.mjs';

test('separates declarations, arrows and class methods; a second pass is stable', () => {
  const source = 'function first() {}\nconst second = () => 2;\nfunction third() {}\n';
  const formatted = formatFunctionSpacing(source);
  assert.equal(formatted, 'function first() {}\n\nconst second = () => 2;\n\nfunction third() {}\n');
  assert.equal(formatFunctionSpacing(formatted), formatted);
  assert.equal(formatFunctionSpacing('class X {\n  first() {}\n  second() {}\n}'), 'class X {\n  first() {}\n\n  second() {}\n}');
});

test('preserves inline comments, leading documentation and function overload groups', () => {
  const source = 'function first() {} // keep\n/** second */\nfunction second() {}';
  assert.equal(formatFunctionSpacing(source), 'function first() {} // keep\n\n/** second */\nfunction second() {}');
  const overload = 'function x(a: string): string;\nfunction x(a: number): number;\nfunction x(a: unknown) { return a; }';
  assert.equal(formatFunctionSpacing(overload), overload);
});

test('handles object function members without altering strings or callbacks', () => {
  const source = 'const o = {\n  a: () => "function fake() {}\\nfunction other() {}",\n  b() {},\n};';
  assert.equal(formatFunctionSpacing(source), 'const o = {\n  a: () => "function fake() {}\\nfunction other() {}",\n\n  b() {},\n};');
  const callbacks = 'run(() => 1);\nrun(() => 2);';
  assert.equal(formatFunctionSpacing(callbacks), callbacks);
});

test('retains CRLF and keeps JSX text unchanged', () => {
  assert.equal(formatFunctionSpacing('function a() {}\r\nfunction b() {}'), 'function a() {}\r\n\r\nfunction b() {}');
  const jsx = 'function View() { return <p>function a() {} function b() {}</p>; }\nfunction Other() {}';
  assert.equal(formatFunctionSpacing(jsx, 'fixture.tsx'), 'function View() { return <p>function a() {} function b() {}</p>; }\n\nfunction Other() {}');
});


test('separates arrow fields and default exports, while keeping constructor overloads together', () => {
  const fields = 'class X {\n  first = () => 1;\n  second = () => 2;\n}';
  assert.equal(formatFunctionSpacing(fields), 'class X {\n  first = () => 1;\n\n  second = () => 2;\n}');
  const overload = 'class X {\n  constructor(a: string);\n  constructor(a: number);\n  constructor(a: unknown) {}\n}';
  assert.equal(formatFunctionSpacing(overload), overload);
  assert.equal(formatFunctionSpacing('export default () => 1;\nconst value = 2;'), 'export default () => 1;\n\nconst value = 2;');
});
