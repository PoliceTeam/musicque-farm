export function validArcadeRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[-a-zA-Z0-9_]{1,100}$/.test(value) &&
    !['__proto__', 'constructor', 'prototype'].includes(value)
  );
}
