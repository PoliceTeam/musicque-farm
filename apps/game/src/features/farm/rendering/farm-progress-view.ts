import type { FarmProgress } from '@chibi-town/gameplay/farm-crop-logic';
import { farmEggBaskets } from '@chibi-town/gameplay/farm-egg-logic';
import { animalTimer, cropTimer, type FarmTimer } from '@chibi-town/gameplay/farm-progress-logic';
import type { FarmAnimal, FarmUnit } from '@chibi-town/gameplay/farm-unit-logic';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { FARM_EGG_BASKET_SPOTS, FARM_PLOTS } from '@/features/farm/_utils/farm-map-data';

type AnimalAnchor = { animal: FarmAnimal; unit: FarmUnit; x: number; y: number };

export function drawFarmProgress(
  renderer: CharacterRenderer,
  state: FarmProgress,
  anchors: AnimalAnchor[],
  now: number,
  labels: { ready: string; paused: string; eggLabel?: (species: 'hen' | 'duck', count: number) => string },
) {
  function draw(status: FarmTimer, x: number, y: number, width: number) {
    const minutes = Math.ceil(status.remainingMs / 60000);
    const text = status.ready
      ? labels.ready
      : `${status.paused ? `${labels.paused} ` : ''}${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
    renderer.rectangle(x - width / 2 - 1, y - 5, width + 2, 6, 0x493c28, 0.9);
    renderer.rectangle(x - width / 2, y - 4, width, 4, 0xe1d7b6);
    renderer.rectangle(x - width / 2, y - 4, (width * status.percent) / 100, 4, status.ready ? 0xf7ce59 : 0x8dbe64);
    renderer.label(text, x, y - 6, status.ready ? '#ffe77a' : '#fff9e8', undefined, 10);
  }

  for (const basket of farmEggBaskets(state, now)) {
    const spot = FARM_EGG_BASKET_SPOTS.find((s) => s.species === basket.species)!;
    if (labels.eggLabel)
      renderer.label(labels.eggLabel(basket.species, basket.eggs), spot.x, spot.y + 16, '#fff9e8', undefined, 10);
  }
  state.plots.slice(0, state.owned).forEach((crop, index) => {
    const status = cropTimer(crop, now);
    const plot = FARM_PLOTS[index];
    if (status && plot) draw(status, plot.area.x0 + 20, plot.area.y0 - 1, 34);
  });
  for (const anchor of anchors) {
    if (anchor.animal) draw(animalTimer(state, anchor.unit, anchor.animal, now), anchor.x, anchor.y + 2, 34);
  }
}
