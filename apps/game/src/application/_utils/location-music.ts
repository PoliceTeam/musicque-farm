import type { MapDefinition } from '@chibi-town/game-content';
import { publicPath } from '@/application/_utils/public-path';

/** One track choice per loaded location; audio service owns caching, fades and playback. */
export function locationMusic(route: string, definition?: Pick<MapDefinition, 'scene' | 'regionId'>) {
  if (definition?.scene === 'arcade' || route === '/arcade')
    return {
      musicUrl: publicPath('/chibi-assets/map/audio/chibi-town-loop.mp3'),
      loopSeconds: 76.8,
      musicEnabled: false,
    };
  if (definition?.scene === 'farm' || route === '/farm' || route === '/farm/home')
    return { musicUrl: publicPath('/chibi-assets/audio/music/farm-meadow-loop.mp3'), loopSeconds: 48 };
  if (definition?.regionId === 'fun' || route === '/pet-racing')
    return { musicUrl: publicPath('/chibi-assets/audio/music/entertainment-fairground-loop.mp3'), loopSeconds: 40 };
  return { musicUrl: publicPath('/chibi-assets/map/audio/chibi-town-loop.mp3'), loopSeconds: 76.8 };
}
