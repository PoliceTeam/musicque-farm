import type { FarmProgress } from '@chibi-town/gameplay/farm-crop-logic';
import { farmFeedingBlend } from '@chibi-town/gameplay/farm-feeding-logic';
import {
  ANIMAL_ART_SCALES,
  ANIMAL_MOTION_STEPS,
  animalArtFrameName,
  animalArtStage,
} from '@/features/farm/_utils/animal-art';
import { separateFarmHerd } from '@/features/farm/_utils/farm-herd-logic';
import { farmFishGroup } from '@/features/farm/_utils/farm-pond-logic';
import { drawAnimalGait } from '@/features/farm/rendering/animal-gait-view';
import { cachedFarmFrames } from '@/features/farm/rendering/farm-frame-cache';
import type { Area } from '@/game/movement/movement-logic';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function createFarmPondMotion(
  asset: (name: string) => HTMLCanvasElement,
  area: Area,
  level: number,
  progress: FarmProgress,
  motionStart = Date.now(),
) {
  const width = area.x1 - area.x0,
    height = area.y1 - area.y0;
  const prefix = `farm-pond-motion-v9-${level}`;
  const waveFrames = cachedFarmFrames(asset, `pond-waves-${width}-${height}`, () =>
    Array.from({ length: 24 }, (_, frame) => {
      const c = canvas(width, height),
        g = c.getContext('2d')!,
        phase = frame / 24;
      g.beginPath();
      g.roundRect(18, 18, width - 36, height - 36, 23);
      g.clip();
      for (let i = 0; i < 27; i++) {
        const x = 28 + ((i * 57) % (width - 56)),
          y = 27 + ((i * 79) % (height - 54));
        const t = (phase + i / 9) % 1;
        g.strokeStyle = `rgba(213,250,255,${0.1 + Math.sin(t * Math.PI) * 0.12})`;
        g.lineWidth = 0.8;
        g.beginPath();
        const drift = Math.sin(phase * Math.PI * 2 + i) * 3;
        g.moveTo(x - 9, y + drift);
        g.quadraticCurveTo(x, y + drift + 2.5, x + 10, y + drift);
        g.stroke();
      }
      for (let i = 0; i < 7; i++) {
        const t = (phase + i * 0.17) % 1;
        g.strokeStyle = `rgba(226,253,255,${(1 - t) * 0.23})`;
        g.beginPath();
        g.ellipse(
          42 + ((i * 29) % (width - 84)),
          48 + ((i * 83) % (height - 96)),
          3 + t * 17,
          1.5 + t * 6,
          0,
          0,
          Math.PI * 2,
        );
        g.stroke();
      }
      return c;
    }),
  );
  const fishFrames = cachedFarmFrames(asset, 'pond-animal-frames', () =>
    (['fish', 'turtle'] as const).map((species) =>
      Array.from({ length: 384 }, (_, variant) => {
        const eating = variant >= 192;
        const facing = Math.floor((variant % 192) / 96);
        const pitch = Math.floor((variant % 96) / 32) - 1;
        const stage = Math.floor((variant % 32) / 8);
        const tick = variant % 8;
        const c = canvas(34, 34),
          g = c.getContext('2d')!;
        const source = asset(
          animalArtFrameName(species, stage, eating ? 'eat' : 'walk', species === 'turtle' && !eating ? 0 : tick),
        );
        const size = 26 * ANIMAL_ART_SCALES[stage];
        const h = Math.min(28, (size * source.height) / source.width);
        g.fillStyle = '#075e8729';
        g.beginPath();
        g.ellipse(17, 21, 10, 3, 0, 0, Math.PI * 2);
        g.fill();
        g.translate(17, 17);
        g.rotate(pitch * 0.12);
        g.scale(facing ? -1 : 1, 1);
        g.globalAlpha = 0.85;
        if (species === 'turtle' && !eating) {
          g.translate(0, h / 2);
          drawAnimalGait(g, source, species, size, h, (tick / 8) * ANIMAL_MOTION_STEPS);
        } else {
          g.drawImage(source, -size / 2, -h / 2, size, h);
        }
        return c;
      }),
    ),
  );
  const waves = { key: `${prefix}-waves-0`, source: waveFrames[0], x: area.x0, y: area.y0, width, height, depth: 0.2 };
  const fishes = Array.from({ length: progress.fish.length }, (_, i) => ({
    key: `${prefix}-fish-${i % 3}-0`,
    source: fishFrames[progress.fish[i].species === 'turtle' ? 1 : 0][0],
    x: 0,
    y: 0,
    width: 34,
    height: 34,
    depth: 0.1,
  }));
  const lotusFrames = cachedFarmFrames(asset, 'pond-lotus-frames', () =>
    [24, 32].map((size) =>
      Array.from({ length: 24 }, (_, frame) => {
        const c = canvas(40, 48),
          g = c.getContext('2d')!,
          source = asset('lotus'),
          phase = (frame / 24) * Math.PI * 2;
        g.strokeStyle = '#c3f6e938';
        g.beginPath();
        g.ellipse(20, 30, 17, 4, 0, 0, Math.PI * 2);
        g.stroke();
        g.translate(20, 24 + Math.sin(phase) * 0.8);
        g.rotate(Math.sin(phase) * 0.045);
        const h = Math.min(40, (size * source.height) / source.width);
        g.drawImage(source, -size / 2, -h / 2, size, h);
        return c;
      }),
    ),
  );
  const lotuses = Array.from({ length: 4 + level * 2 }, (_, i) => ({
    key: `${prefix}-lotus-${i % 2}-0`,
    source: lotusFrames[i % 2][0],
    x: area.x0 + 38 + ((i * 43) % (width - 76)) - 20,
    y: area.y0 + 52 + ((i * 67) % (height - 100)) - 24,
    width: 40,
    height: 48,
    depth: 0.5,
  }));
  const wakeFrames = cachedFarmFrames(asset, 'pond-wake-frames', () =>
    Array.from({ length: 48 }, (_, frame) => {
      const c = canvas(34, 34),
        g = c.getContext('2d')!;
      g.translate(17, 17);
      g.rotate((Math.floor(frame / 2) / 24) * Math.PI * 2);
      g.strokeStyle = '#d3fafb32';
      g.lineWidth = 0.7;
      g.beginPath();
      // A faint underwater trail, without the boat-like surface wake.
      g.strokeStyle = '#d3fafb18';
      g.ellipse(-11, 0, 3 + (frame % 2), 1.2, 0, 0, Math.PI * 2);
      g.stroke();
      return c;
    }),
  );
  const wakes = fishes.map((_, i) => ({
    key: `${prefix}-wake-0`,
    source: wakeFrames[0],
    x: 0,
    y: 0,
    width: 34,
    height: 34,
    depth: 0.23 + i * 0.0001,
  }));
  let positions: ReturnType<typeof farmFishGroup> = [];
  let previousTime = 0;
  const facings = fishes.map(() => 0);

  function sync(time: number, motionTime = Date.now()) {
    const frame = Math.floor(motionTime / 110) % waveFrames.length;
    waves.source = waveFrames[frame];
    waves.key = `${prefix}-waves-${frame}`;
    lotuses.forEach((lotus, i) => {
      const f = (Math.floor(motionTime / 150) + i * 3) % 24;
      lotus.source = lotusFrames[i % 2][f];
      lotus.key = `${prefix}-lotus-${i % 2}-${f}`;
    });
    const elapsed = Math.max(0, motionTime - motionStart);
    const eating = farmFeedingBlend(progress.fedAt.pond, time);
    const targets = farmFishGroup(width, height, fishes.length, elapsed, eating, 390 - area.y0);
    const dt = previousTime ? Math.min(0.05, Math.max(0, (motionTime - previousTime) / 1000)) : 0;
    previousTime = motionTime;
    positions = targets.map((p, i) => {
      const old = positions[i];
      if (!old) return p;
      const dx = p.x - old.x,
        dy = p.y - old.y,
        d = Math.hypot(dx, dy),
        t = d ? Math.min(1, (dt * 36) / d) : 1;
      return { ...p, x: old.x + dx * t, y: old.y + dy * t, angle: d > 0.3 ? Math.atan2(dy, dx) : old.angle };
    });
    separateFarmHerd(positions, { x0: 40, x1: width - 40, y0: 41, y1: height - 41 });
    fishes.forEach((fish, index) => {
      const pose = positions[index];
      const angle = (Math.round((pose.angle / (Math.PI * 2)) * 24) + 24) % 24;
      // Keep facing while travelling vertically, avoiding flicker around a turn.
      if (Math.abs(Math.cos(pose.angle)) > 0.2) facings[index] = Math.cos(pose.angle) < 0 ? 1 : 0;
      const stage = animalArtStage(progress.fish[index], time),
        tail = Math.floor(motionTime / 90 + index * 3) % 8,
        facing = facings[index],
        pitch = Math.abs(Math.sin(pose.angle)) < 0.35 ? 1 : Math.sin(pose.angle) > 0 ? 2 : 0,
        variant = (eating > 0.95 ? 192 : 0) + facing * 96 + pitch * 32 + stage * 8 + tail;
      fish.source = fishFrames[progress.fish[index].species === 'turtle' ? 1 : 0][variant];
      fish.key = `${prefix}-fish-${progress.fish[index].species}-${variant}`;
      fish.x = area.x0 + pose.x - 17;
      fish.y = area.y0 + pose.y - 17;
      const wake = angle * 2 + (tail % 2);
      wakes[index].source = wakeFrames[wake];
      wakes[index].key = `${prefix}-wake-${wake}`;
      wakes[index].x = fish.x;
      wakes[index].y = fish.y;
    });
  }

  sync(Date.now());
  return { surfaces: [...fishes, waves, ...wakes, ...lotuses], fishes, sync };
}
