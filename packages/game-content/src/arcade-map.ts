import type { MapDefinition } from './world.js';
export const arcadeMap: MapDefinition = {
  id: 'arcade-hall',
  regionId: 'fun',
  scene: 'arcade',
  label: 'Khu GAME',
  width: 1280,
  height: 720,
  spawn: [640, 630],
  systems: ['arcade'],
  portals: [{ id: 'exit', target: 'entertainment-street', spawn: [455, 580] }],
};
