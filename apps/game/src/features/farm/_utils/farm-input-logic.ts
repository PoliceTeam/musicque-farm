import type { FarmProgress, FarmUnit } from '@chibi-town/gameplay';
import {
  FARM_EGG_BASKET_SPOTS,
  FARM_EXIT,
  FARM_PLOTS,
  type FarmSelection,
  farmExpansionAt,
  farmFeatureAt,
  farmFeaturesFor,
  farmPlotAt,
  farmUnitPurchaseAt,
} from '@/features/farm/_utils/farm-layout';

type FarmHit = { selection?: FarmSelection } & (
  | { kind: 'exit' | 'none' | 'warehouse' | 'kitchen' }
  | { kind: 'plot'; index: number }
  | { kind: 'unit' | 'shop'; unit: FarmUnit }
);

export function farmInputAt(state: FarmProgress, x: number, y: number): FarmHit {
  if (x >= FARM_EXIT.area.x0 && x <= FARM_EXIT.area.x1 && y >= FARM_EXIT.area.y0) return { kind: 'exit' };
  const basket = FARM_EGG_BASKET_SPOTS.find(
    (spot) =>
      state.poultry.some((animal) => animal.species === spot.species) &&
      Math.abs(x - spot.x) < 24 &&
      y > spot.y - 40 &&
      y < spot.y + 18,
  );
  if (basket) return { kind: 'unit', unit: 'poultry', selection: { stand: [basket.x, basket.y + 24] } };
  const plot =
    farmPlotAt(x, y, state.owned) ?? (farmExpansionAt(x, y, state.owned) ? FARM_PLOTS[state.owned] : undefined);
  if (plot) return { kind: 'plot', index: FARM_PLOTS.indexOf(plot), selection: plot };
  const features = farmFeaturesFor(state.units);
  const purchase = farmUnitPurchaseAt(x, y, features, state.capacity);
  if (purchase?.id === 'livestock' || purchase?.id === 'pond')
    return { kind: 'shop', unit: purchase.id, selection: { stand: purchase.stand } };
  const feature = farmFeatureAt(x, y, features, state.capacity);
  const selection = feature ? { stand: feature.stand } : undefined;
  if (feature?.id === 'store') return { kind: 'warehouse', selection };
  if (feature?.id === 'kitchen') return { kind: 'kitchen', selection };
  if (feature?.id === 'livestock' || feature?.id === 'pond') return { kind: 'unit', unit: feature.id, selection };
  return { kind: 'none' };
}
