import { createFarmProgress } from '@chibi-town/gameplay';
import { expect, it } from 'vitest';
import { farmInputAt } from '@/features/farm/_utils/farm-input-logic';
import { FARM_EXIT, FARM_PLOTS, farmFeaturesFor } from '@/features/farm/_utils/farm-layout';

it('resolves the shared exit, owned plots, expansion and building actions', () => {
  const state = createFarmProgress();
  expect(farmInputAt(state, FARM_EXIT.stand[0], FARM_EXIT.stand[1]).kind).toBe('exit');
  for (const index of [0, state.owned]) {
    const plot = FARM_PLOTS[index];
    expect(farmInputAt(state, plot.area.x0 + 5, plot.area.y0 + 5)).toMatchObject({
      kind: 'plot',
      index,
      selection: plot,
    });
  }
  const store = farmFeaturesFor(state.units).find((feature) => feature.id === 'store')!;
  expect(farmInputAt(state, store.area.x0 + 5, store.area.y0 + 5)).toMatchObject({
    kind: 'warehouse',
    selection: { stand: store.stand },
  });
});
