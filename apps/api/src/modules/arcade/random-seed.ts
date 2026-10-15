import { randomBytes } from 'node:crypto';

export function randomSeed(): [number, number, number, number] {
  const bytes = randomBytes(16);
  return [0, 4, 8, 12].map((offset) => bytes.readUInt32LE(offset)) as [number, number, number, number];
}
