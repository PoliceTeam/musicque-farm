import type { MapDefinition } from '@chibi-town/game-content';
import { createServiceNpc } from '@chibi-town/game-content/service-npc';
import type { CharacterRenderer } from '@chibi-town/render-contracts/renderer-types';
import { expect, it, vi } from 'vitest';
import { locationInputAt } from '@/features/location/_utils/location-input-logic';
import { serviceNpcAt } from '@/game/npc/service-npc-logic';
import { createServiceNpcView } from '@/game/rendering/service-npc-view';

it('reuses grounded artwork/name/menu configuration for different NPC roles', () => {
  for (const role of ['jewelry', 'pets'] as const) {
    const npc = createServiceNpc({ id: role, role, service: role, feet: [300, 560] });
    expect(npc.asset).toBe(`npc:${role}`);
    expect(npc.x + npc.width / 2).toBe(300);
    expect(npc.y + npc.height).toBe(560);
    expect(serviceNpcAt([npc], 300, 500)).toBe(npc);
    expect(serviceNpcAt([npc], 500, 500)).toBeUndefined();
    const map: MapDefinition = {
      id: 'test',
      label: 'Test',
      regionId: 'center',
      scene: 'location',
      width: 1000,
      height: 1000,
      systems: [],
      spawn: [500, 700],
      portals: [],
      layers: [
        {
          id: 'building',
          x: 0,
          y: 0,
          width: 1000,
          height: 1000,
          depth: 1,
          destination: { regionId: 'center', mapId: 'other' },
        },
        npc,
      ],
    };
    expect(locationInputAt(map, 300, 500)).toEqual({ kind: 'shop', shop: role });
  }
});
it('shares visible-head anchoring and live translated names without rescanning the image every frame', () => {
  const npc = createServiceNpc({ id: 'npc', role: 'jewelry', service: 'jewelry', feet: [300, 560] });
  const pixels = new Uint8ClampedArray(100 * 130 * 4);
  pixels[(13 * 100 + 10) * 4 + 3] = 255;
  pixels[(125 * 100 + 89) * 4 + 3] = 255;
  const read = vi.fn(() => ({ data: pixels }));
  const source = {
    width: 100,
    height: 130,

    getContext: () => ({ getImageData: read }),
  } as unknown as HTMLCanvasElement;
  let name = 'Thợ kim hoàn';
  const component = createServiceNpcView(npc, source, () => name);
  const label = vi.fn(),
    surface = vi.fn();
  const view = { label, surface } as unknown as CharacterRenderer;
  component.paint(view);
  component.paintLabel(view);
  const placement = surface.mock.calls[0];
  expect(placement[0]).toBe('service-npc:npc');
  expect(placement[2]).toBeCloseTo(300 - (50 * 72) / 113);
  expect(placement[3]).toBeCloseTo(560 - (126 * 72) / 113);
  expect(placement[4]).toBeCloseTo((100 * 72) / 113);
  expect(placement[5]).toBeCloseTo((130 * 72) / 113);
  expect(label.mock.calls[0]).toEqual([
    'Thợ kim hoàn',
    300,
    474,
    '#ffe066',
    undefined,
    14,
    { text: '*', color: '#ff4444' },
  ]);
  name = 'Jeweler';
  component.paintLabel(view);
  expect(label.mock.calls[1][0]).toBe('Jeweler');
  expect(read).toHaveBeenCalledOnce();
});
