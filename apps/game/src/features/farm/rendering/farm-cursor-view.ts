import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import type { Area } from '@/game/movement/movement-logic';

export function createFarmCursor() {
  const source = document.createElement('canvas');
  source.width = 44;
  source.height = 44;
  const g = source.getContext('2d')!;
  const path = new Path2D('M2 10V2h8M34 2h8v8M42 34v8h-8M10 42H2v-8');
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  g.stroke(path);
  g.strokeStyle = '#247fa0';
  g.lineWidth = 0.5;
  g.stroke(path);
  return (renderer: CharacterRenderer, selected: Area | undefined) => {
    if (selected) renderer.surface('farm-selection-cursor', source, selected.x0 - 2, selected.y0 - 2, 44, 44);
  };
}
