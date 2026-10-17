import type { RealtimeCommand } from '@chibi-town/contracts/realtime';
import type { RealtimeService } from '@chibi-town/realtime-core';
import type { PlayerAccount } from '@/_utils/session-auth';
import { registerPetRaceRealtime } from '@/modules/arcade/pet-racing';

export function registerArcadeRealtime(
  realtime: RealtimeService,
  lobbyTopic: (player: PlayerAccount, gameId: string) => Promise<string>,
) {
  registerPetRaceRealtime(realtime);
  const watching = new Map<string, string>();
  realtime.handle<Extract<RealtimeCommand, { type: 'lobby.watch' }>>(
    'lobby.watch',
    async (connection, command) => {
      const previous = watching.get(connection.id);
      if (previous) await realtime.unsubscribe(connection, previous);
      const topic = await lobbyTopic(connection.identity.context as PlayerAccount, command.gameId);
      watching.set(connection.id, topic);
      await realtime.subscribe(connection, topic);
    },
    { expensive: true },
  );
  realtime.handle('lobby.unwatch', async (connection) => {
    const topic = watching.get(connection.id);
    if (topic) await realtime.unsubscribe(connection, topic);
    watching.delete(connection.id);
  });
  realtime.onDisconnect(async (connection) => {
    watching.delete(connection.id);
  });
}
