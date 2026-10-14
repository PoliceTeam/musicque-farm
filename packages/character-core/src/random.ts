/** Small seeded generator (Park–Miller), so scenery and tests are repeatable. Returns [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = Math.floor(Math.abs(seed)) % 2147483647 || 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export function pick<T>(list: readonly T[], random: () => number = Math.random): T {
  return list[Math.floor(random() * list.length)];
}
