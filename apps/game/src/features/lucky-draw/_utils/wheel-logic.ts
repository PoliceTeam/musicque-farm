/** Place the winning sector's center under the fixed pointer after six full revolutions. */
export function nextWheelRotation(current: number, prizeIndex: number, count: number) {
  const target = (360 - (prizeIndex + 0.5) * (360 / count)) % 360;
  return current + 2160 + ((target - (current % 360) + 360) % 360);
}
