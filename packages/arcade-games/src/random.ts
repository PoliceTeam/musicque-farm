/** Persisted sfc32 state. Numeric seeds are accepted only for old saves and deterministic fixtures. */
export type RandomSeed = number | [number, number, number, number];

export function isRandomSeed(value: unknown): value is RandomSeed {
  const word = (n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 0xffffffff;

  return typeof value === 'number' ? word(value) : Array.isArray(value) && value.length === 4 && value.every(word);
}

export function normalizeSeed(seed: RandomSeed): [number, number, number, number] {
  if (Array.isArray(seed)) return [...seed];
  let n = seed >>> 0;

  const word = () => {
    n = (n + 0x9e3779b9) >>> 0;
    let v = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
    v = Math.imul(v ^ (v >>> 15), 0x735a2d97);
    return (v ^ (v >>> 15)) >>> 0;
  };

  return [word(), word(), word(), word()];
}

/** Pure deterministic sfc32; entropy is supplied by the caller, never by the engine. */
export function random(state: { seed: RandomSeed }): number {
  let [a, b, c, d] = normalizeSeed(state.seed);
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = ((c << 21) | (c >>> 11)) + t;
  state.seed = [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
  return (t >>> 0) / 4294967296;
}
