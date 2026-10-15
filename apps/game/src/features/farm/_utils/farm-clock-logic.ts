/** Presentation time advances independently of snapshot revisions; never changes saved progress. */
export function farmTimeAt(anchor: { server: number; real: number }, real: number, scale: number) {
  return anchor.server + Math.max(0, real - anchor.real) * scale;
}
