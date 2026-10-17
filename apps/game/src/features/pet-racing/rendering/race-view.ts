import { items, pets } from '@chibi-town/character-core/item-catalog';
import { layoutAvatar } from '@chibi-town/character-core/layout-logic';
import { toEquip } from '@chibi-town/character-core/outfit-logic';
import { RACE_PETS, type RaceResult } from '@chibi-town/contracts/pet-racing';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { petSheet, sheet } from '@/assets/asset-catalog';
import { createRaceAudience } from '@/features/pet-racing/_utils/race-audience';
import { raceProgress } from '@/features/pet-racing/_utils/race-logic';
import { raceSceneLayout } from '@/features/pet-racing/_utils/race-scene-layout';
import { loadRaceScenery } from '@/features/pet-racing/rendering/race-scene-assets';

/** Compose independent raster props in world space; no full-screen baked background. */
export async function createRaceView() {
  const resource = await loadRaceScenery();
  const audience = createRaceAudience().map((npc) => ({
    ...npc,
    ops: layoutAvatar(items, sheet, toEquip(npc.outfit), 0, false),
  }));

  function surface(view: CharacterRenderer, id: string, x: number, y: number, width: number, height: number) {
    view.surface(id, resource.assets.get(id)!, x, y, width, height);
  }

  function repeat(view: CharacterRenderer, id: string, width: number, y: number, height: number) {
    const image = resource.assets.get(id)!;
    const tileWidth = (image.width * height) / image.height;
    for (let x = 0; x < width; x += tileWidth) surface(view, id, x, y, tileWidth, height);
  }

  return {
    release: resource.release,

    draw(
      view: CharacterRenderer,
      now: number,
      viewport: { width: number; height: number },
      race?: Pick<RaceResult, 'finishTimes'>,
      elapsed = 0,
      reducedMotion = false,
      selected = 0,
    ) {
      const map = raceSceneLayout(viewport.width, viewport.height);
      const { width, height, unit, trackTop, trackBottom, pitch } = map;
      view.beginFrame();
      view.rectangle(0, 0, width, height, 0x4fbdf1);
      for (let index = 0; index < 3; index++) {
        const drift = reducedMotion ? 0 : Math.sin(now / 50000 + index * 2) * 20 * unit;
        surface(
          view,
          'scenery:cloud',
          width * (index * 0.36 + 0.02) + drift,
          25 + (index % 2) * 40 * unit,
          180 * unit,
          74 * unit,
        );
      }
      repeat(view, 'scenery:skyline', width, map.benchTop - 135 * unit, 175 * unit);
      for (let x = -40 * unit, index = 0; x < width; x += 128 * unit, index++) {
        const id = index % 3 === 0 ? 'scenery:tree-alt' : 'scenery:tree';
        const image = resource.assets.get(id)!;
        const treeHeight = 160 * unit;
        surface(view, id, x, map.seatY + 15 * unit - treeHeight, (treeHeight * image.width) / image.height, treeHeight);
      }
      repeat(
        view,
        'pet-racing/dirt.webp',
        width,
        map.benchTop + map.benchHeight - 5 * unit,
        trackTop - map.benchTop - map.benchHeight + 5 * unit,
      );
      const benchCount = Math.max(1, Math.min(6, Math.floor(width / (300 * unit))));
      const benchImage = resource.assets.get('pet-racing/bench.webp')!;
      const benchWidth = Math.min(
        (width - 18 * unit * (benchCount + 1)) / benchCount,
        (map.benchHeight * benchImage.width) / benchImage.height,
      );
      const benchGap = (width - benchWidth * benchCount) / (benchCount + 1);
      for (let index = 0; index < benchCount; index++)
        surface(
          view,
          'pet-racing/bench.webp',
          benchGap + index * (benchWidth + benchGap),
          map.benchTop,
          benchWidth,
          map.benchHeight,
        );
      for (let index = 0; index <= benchCount; index++) {
        const x = benchGap / 2 + index * (benchWidth + benchGap);
        surface(view, 'scenery:shrubs', x - 18 * unit, map.seatY - 9 * unit, 36 * unit, 32 * unit);
        surface(view, 'scenery:flower-patch', x - 25 * unit, trackTop - 25 * unit, 50 * unit, 36 * unit);
      }
      audience.forEach((npc, index) => {
        const bench = Math.floor((index * benchCount) / audience.length);
        const first = Math.ceil((bench * audience.length) / benchCount);
        const count = Math.ceil(((bench + 1) * audience.length) / benchCount) - first;
        const x = benchGap + bench * (benchWidth + benchGap) + (benchWidth * (index - first + 1)) / (count + 1);
        view.drawPieces('character', sheet, npc.ops, x, map.seatY, unit);
      });
      repeat(view, 'pet-racing/track-curb.webp', width, trackTop - 9 * unit, 9 * unit);
      for (let lane = 0; lane < 6; lane++) {
        repeat(view, 'pet-racing/turf.webp', width, trackTop + lane * pitch, pitch);
        if (lane % 2) view.rectangle(0, trackTop + lane * pitch, width, pitch, 0x103c19, 0.08);
        view.rectangle(0, trackTop + lane * pitch, width, 1.5 * unit, 0xfff9dc, 0.85);
        view.label(String(lane + 1), 10 * unit, trackTop + (lane + 0.65) * pitch, '#fff7dd', '#326732', 12 * unit);
      }
      view.rectangle(0, trackBottom - 2 * unit, width, 2 * unit, 0xfff9dc);
      view.rectangle(map.start, trackTop, 3 * unit, trackBottom - trackTop, 0xfff7df);
      const check = Math.max(3, Math.round(5 * unit));
      for (let row = 0; row * check < trackBottom - trackTop; row++)
        for (let col = 0; col < 2; col++)
          view.rectangle(
            map.finish + col * check,
            trackTop + row * check,
            check,
            Math.min(check, trackBottom - trackTop - row * check),
            (row + col) % 2 ? 0x25372c : 0xfff8dc,
          );
      RACE_PETS.forEach((entry, lane) => {
        const pet = pets[entry.id];
        const running = race && elapsed > 0 && elapsed < race.finishTimes[lane];
        const frames = pet.walk ?? pet.flap ?? [pet.piece];
        const piece = running && !reducedMotion ? frames[Math.floor(now / 110) % frames.length] : pet.piece;
        const size = petSheet.pieces[piece];
        const scale = Math.min(1.5, (pitch * 0.72) / Math.max(...frames.map((frame) => petSheet.pieces[frame].height)));
        const progress = race ? raceProgress(race, lane, elapsed, reducedMotion) : 0;
        const x = map.start + progress * (map.finish - map.start);
        const y = map.lanes[lane];
        const hop = running && !reducedMotion ? Math.abs(Math.sin(now / 100 + lane)) * 2 * unit : 0;
        view.rectangle(x - 16 * unit, y - 2 * unit, 32 * unit, 4 * unit, 0x234d25, 0.28);
        if (lane === selected) view.marker('race-selected', x, y - size.height * scale - 8 * unit);
        view.drawPieces(
          'pets',
          petSheet,
          [{ piece, x: -size.width / 2, y: -size.height - hop, flip: false }],
          x,
          y,
          scale,
        );
      });
      repeat(view, 'pet-racing/fence.webp', width, trackBottom, map.gardenHeight);
      view.endFrame();
    },
  };
}
