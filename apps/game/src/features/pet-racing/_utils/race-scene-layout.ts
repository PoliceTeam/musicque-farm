/** Scene geometry belongs to the viewport, rather than a scaled background image. */
export function raceSceneLayout(width: number, height: number) {
  const unit = Math.max(0.55, Math.min(1.25, width / 1100, height / 620));
  const header = Math.min(width <= 700 ? 136 : 104, height * 0.28);
  const benchHeight = Math.min(80 * unit, height * 0.16);
  const gardenHeight = Math.max(24, Math.min(76, height * 0.1));
  const trackTop = Math.round(Math.min(height * 0.56, Math.max(height * 0.4, header + benchHeight + 16 * unit)));
  const trackBottom = height - gardenHeight;
  const pitch = (trackBottom - trackTop) / 6;
  const start = Math.round(Math.max(42, width * 0.065));
  const finish = width - Math.round(Math.max(36, width * 0.05));
  const benchBottom = trackTop - 20 * unit;
  return {
    width,
    height,
    unit,
    trackTop,
    trackBottom,
    pitch,
    start,
    finish,
    benchTop: benchBottom - benchHeight,
    benchHeight,
    seatY: benchBottom - benchHeight * 0.16,
    gardenHeight,
    lanes: Array.from({ length: 6 }, (_, lane) => trackTop + (lane + 0.76) * pitch),
  };
}
