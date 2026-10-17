import type { RealtimeService } from '@chibi-town/realtime-core';
export const PET_RACE_TOPIC = 'arcade:pet-racing';

export function registerPetRaceRealtime(realtime: RealtimeService) {
  realtime.handle('pet-race.watch', async (connection) => {
    await realtime.subscribe(connection, PET_RACE_TOPIC);
  });
  realtime.handle('pet-race.unwatch', async (connection) => {
    await realtime.unsubscribe(connection, PET_RACE_TOPIC);
  });
}
