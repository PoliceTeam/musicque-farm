import { expect, it } from 'vitest';
import { raceSceneLayout } from '@/features/pet-racing/_utils/race-scene-layout';

it('lays out all lanes and finish markers directly in each viewport without cropping a fixed image', () => {
  for (const [width, height] of [
    [1440, 750],
    [1920, 920],
    [3440, 1200],
    [475, 590],
    [390, 450],
    [800, 280],
  ]) {
    const map = raceSceneLayout(width, height);
    expect(map.width).toBe(width);
    expect(map.height).toBe(height);
    expect(map.start).toBeGreaterThan(20);
    expect(map.finish).toBeLessThan(width - 20);
    expect(map.finish).toBeGreaterThan(map.start);
    expect(map.lanes).toHaveLength(6);
    expect(map.trackTop).toBeGreaterThan(map.seatY);
    for (let index = 0; index < 6; index++) {
      expect(map.lanes[index]).toBeGreaterThan(map.trackTop + index * map.pitch);
      expect(map.lanes[index]).toBeLessThan(map.trackTop + (index + 1) * map.pitch);
      expect(map.lanes[index]).toBeLessThan(height - map.gardenHeight);
    }
    expect(map.trackBottom + map.gardenHeight).toBe(height);
  }
});
