import type { FarmSpecies } from '@chibi-town/game-content/farm-animal-logic';
import { ANIMAL_MOTION_STEPS } from '@/features/farm/_utils/animal-art';

/** Keep one silhouette while alternating the feet, instead of cycling growth-like sheet poses. */
export function drawAnimalGait(
  g: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  species: FarmSpecies,
  width: number,
  height: number,
  tick: number,
) {
  const phase = (tick / ANIMAL_MOTION_STEPS) * Math.PI * 2;
  const bird = species === 'hen' || species === 'duck';
  const legs = bird ? 2 : 4;
  const legShare =
    species === 'turtle'
      ? 0.18
      : species === 'buffalo'
        ? 0.16
        : species === 'sheep'
          ? 0.17
          : species === 'pig'
            ? 0.18
            : 0.2;
  const split = Math.floor(source.height * (1 - legShare));
  const legHeight = (height * (source.height - split)) / source.height;
  const bodyHeight = height - legHeight;
  const bob = Math.sin(phase) ** 2 * Math.max(0.15, width * 0.006);
  const stride = Math.max(0.55, width * (bird ? 0.05 : 0.035));
  g.drawImage(source, 0, 0, source.width, split, -width / 2, -height - bob, width, bodyHeight);
  for (let leg = 0; leg < legs; leg++) {
    // Opposite pairs: back-near/front-far, then back-far/front-near.
    const sign = bird ? (leg === 0 ? 1 : -1) : leg === 0 || leg === 3 ? 1 : -1;
    const swing = Math.sin(phase) * sign;
    const lift = Math.max(0, swing) * Math.max(0.35, width * 0.016);
    const sourceX = (source.width * leg) / legs;
    const destinationX = -width / 2 + (width * leg) / legs;
    g.save();
    g.translate(destinationX + width / legs / 2, -legHeight - bob);
    // The hip stays attached; the foot swings outward around it.
    g.transform(1, 0, (swing * stride) / legHeight, 1 - lift / legHeight, 0, 0);
    g.drawImage(
      source,
      sourceX,
      split - 1,
      source.width / legs,
      source.height - split + 1,
      -width / legs / 2,
      -height / source.height,
      width / legs,
      legHeight + height / source.height,
    );
    g.restore();
  }
}
