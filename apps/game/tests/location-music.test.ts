import { expect, it } from 'vitest';
import { locationMusic } from '@/application/_utils/location-music';

it('uses the entertainment loop for entertainment locations', () => {
  expect(locationMusic('/location', { scene: 'location', regionId: 'fun' })).toEqual({
    musicUrl: '/chibi-assets/audio/music/entertainment-fairground-loop.mp3',
    loopSeconds: 40,
  });
});
it('keeps farm music on both direct and world-map entry routes', () => {
  expect(locationMusic('/farm')).toEqual(locationMusic('/location', { scene: 'farm', regionId: 'farm' }));
  expect(locationMusic('/farm').musicUrl).toContain('farm-meadow-loop');
});
it('returns to world music when leaving entertainment', () => {
  expect(locationMusic('/map').musicUrl).toContain('chibi-town-loop');
  expect(locationMusic('/character')).toEqual(locationMusic('/map'));
});

it('uses effects only in arcade on both entry routes', () => {
  expect(locationMusic('/arcade').musicEnabled).toBe(false);
  expect(locationMusic('/location', { scene: 'arcade', regionId: 'fun' })).toEqual(locationMusic('/arcade'));
  expect(locationMusic('/location', { scene: 'location', regionId: 'fun' }).musicEnabled).toBeUndefined();
});
