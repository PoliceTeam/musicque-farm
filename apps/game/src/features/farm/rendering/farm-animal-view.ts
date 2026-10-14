import type { FarmSpecies } from '@chibi-town/game-content/farm-animal-logic';
import type { FarmProgress } from '@chibi-town/gameplay/farm-crop-logic';
import { farmFeedingBlend } from '@chibi-town/gameplay/farm-feeding-logic';
import {
  ANIMAL_MOTION_GROUP,
  ANIMAL_MOTION_STEP_MS,
  ANIMAL_MOTION_STEPS,
  animalArtFrameName,
  animalArtStage,
  animalArtWidth,
} from '@/features/farm/_utils/animal-art';
import { farmRoamPose, separateFarmHerd } from '@/features/farm/_utils/farm-animal-logic';
import { drawAnimalGait } from '@/features/farm/rendering/animal-gait-view';
import type { Area } from '@/game/movement/movement-logic';
import { cachedFarmFrames } from './farm-frame-cache';

export function createFarmAnimalFrames(asset: (name: string) => HTMLCanvasElement) {
  const species: FarmSpecies[] = ['cow', 'pig', 'sheep', 'hen', 'duck', 'buffalo', 'dog'];
  return cachedFarmFrames(asset, 'land-animal-frames', () =>
    Object.fromEntries(
      species.map((name) => [
        name,
        Array.from({ length: 4 }, (_, stage) =>
          Array.from({ length: ANIMAL_MOTION_GROUP * 3 }, (_, frame) => {
            const c = document.createElement('canvas');
            c.width = 52;
            c.height = 48;
            const g = c.getContext('2d')!;
            const tick = frame % ANIMAL_MOTION_STEPS;
            const action = frame < ANIMAL_MOTION_GROUP ? 'walk' : frame < ANIMAL_MOTION_GROUP * 2 ? 'eat' : 'idle';
            // Sheet poses change proportions; keep one source per action to avoid body flicker.
            const source = asset(animalArtFrameName(name, stage, action === 'walk' ? 'idle' : action, 0));
            const width = animalArtWidth(name, stage);
            const height = Math.min(39, (width * source.height) / source.width);
            g.fillStyle = '#57402730';
            g.beginPath();
            g.ellipse(26, 44, width * 0.4, 2.5, 0, 0, Math.PI * 2);
            g.fill();
            g.translate(26, 44);
            g.scale(frame % ANIMAL_MOTION_GROUP >= ANIMAL_MOTION_STEPS ? -1 : 1, 1);
            if (action === 'walk') {
              drawAnimalGait(g, source, name, width, height, tick);
            } else {
              const breathe = Math.sin((tick / ANIMAL_MOTION_STEPS) * Math.PI * 2) * 0.18;
              g.drawImage(source, -width / 2, -height - breathe, width, height);
            }
            return c;
          }),
        ),
      ]),
    ),
  );
}

export function createFarmAnimalMotion(
  asset: (name: string) => HTMLCanvasElement,
  area: Area,
  progress: FarmProgress,
  free = false,
  motionStart = Date.now(),
) {
  const frames = createFarmAnimalFrames(asset);
  const herd = free ? progress.poultry : progress.animals;
  const unit = free ? 'poultry' : 'livestock';
  const surfaces = herd.map((_, i) => ({
    key: `animal-v15-${unit}-${i}-0-0`,
    source: frames[herd[i].species as keyof typeof frames][0][0],
    x: 0,
    y: 0,
    width: 52,
    height: 48,
    depth: 0,
  }));
  const safe = free ? { ...area } : { x0: area.x0 + 34, x1: area.x1 - 34, y0: area.y0 + 125, y1: area.y1 - 53 };
  const facings = herd.map(() => false);
  let previousTime = 0;
  let positions: ReturnType<typeof separateFarmHerd> = [];

  function sync(now: number, motionTime = Date.now()) {
    const herd = free ? progress.poultry : progress.animals;
    const elapsed = Math.max(0, motionTime - motionStart);
    const poses = surfaces.map((_, i) => {
      const pose = farmRoamPose(safe, i, elapsed);
      const eating = farmFeedingBlend(progress.fedAt[unit], now);
      const foodX = Math.max(safe.x0, Math.min(safe.x1, area.x0 + (area.x1 - area.x0) * 0.59 + ((i % 4) - 1.5) * 38));
      const foodY = Math.max(safe.y0, Math.min(safe.y1, area.y0 + (free ? 30 : 145) + Math.floor(i / 4) * 32));
      if (eating > 0) {
        pose.angle = Math.atan2(foodY - pose.y, foodX - pose.x);
        pose.x += (foodX - pose.x) * eating;
        pose.y += (foodY - pose.y) * eating;
        pose.moving = eating < 0.99;
      }
      const stage = animalArtStage(herd[i], now);
      const width = animalArtWidth(herd[i].species, stage);
      return { ...pose, stage, radiusX: width / 2 + 2, radiusY: 11 };
    });
    const targets = separateFarmHerd(
      poses.map((p) => ({ ...p })),
      safe,
    );
    const dt = previousTime ? Math.min(0.05, Math.max(0, (motionTime - previousTime) / 1000)) : 0;
    previousTime = motionTime;
    const old = positions.map((p) => ({ ...p }));
    positions = positions.length
      ? separateFarmHerd(
          targets.map((p, i) => {
            const from = positions[i],
              distance = Math.hypot(p.x - from.x, p.y - from.y),
              t = distance ? Math.min(1, (dt * 26) / distance) : 1;
            return { ...p, x: from.x + (p.x - from.x) * t, y: from.y + (p.y - from.y) * t };
          }),
          safe,
        )
      : targets;
    surfaces.forEach((entry, i) => {
      const pose = positions[i],
        stage = poses[i].stage;
      const dx = old[i] ? pose.x - old[i].x : 0,
        dy = old[i] ? pose.y - old[i].y : 0;
      const moving = Math.hypot(dx, dy) > 0.025;
      const feeding = farmFeedingBlend(progress.fedAt[unit], now) > 0.95 && !moving;
      if (Math.abs(dx) > 0.04) facings[i] = dx < 0;
      const face = facings[i];
      const step = Math.floor(motionTime / ANIMAL_MOTION_STEP_MS + i * 5) % ANIMAL_MOTION_STEPS;
      const frame =
        (feeding ? ANIMAL_MOTION_GROUP + step : moving ? step : ANIMAL_MOTION_GROUP * 2 + step) +
        (face ? ANIMAL_MOTION_STEPS : 0);
      entry.source = frames[herd[i].species as keyof typeof frames][stage][frame];
      entry.key = `animal-v20-${herd[i].species}-${stage}-${frame}`;
      entry.x = pose.x - 26;
      entry.y = pose.y - 44;
      entry.depth = pose.y;
    });
  }

  sync(Date.now());
  return { surfaces, sync };
}
