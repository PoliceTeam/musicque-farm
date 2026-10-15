import { ApiSdkError } from '@chibi-town/contracts';
import type { RealtimeCommand } from '@chibi-town/contracts/realtime';
import { resolveMap } from '@chibi-town/game-content';
import type { RealtimeService } from '@chibi-town/realtime-core';
import type { PlayerAccount } from '@/_utils/session-auth';
import { createMapRooms } from '@/modules/world/map-rooms';
import type { WorldService } from '@/modules/world/service';

export function registerWorldRealtime(realtime: RealtimeService, world: WorldService, clock: () => number) {
  const rooms = createMapRooms(realtime, clock);
  realtime.handle<Extract<RealtimeCommand, { type: 'map.enter' }>>(
    'map.enter',
    async (connection, command) => {
      const map = resolveMap(command.regionId, command.mapId);
      if (!map?.channels || command.x > map.width || command.y > map.height) return;
      const player = connection.identity.context as PlayerAccount;
      const state = await world.getMapState(player, { regionId: command.regionId, mapId: command.mapId });
      if (
        !(await rooms.enter(
          connection,
          map.id,
          state.channelId,
          [map.width, map.height],
          {
            ...player,
            outfit: state.outfit,
            x: command.x,
            y: command.y,
          },
          map.channels.capacity,
        ))
      )
        throw new ApiSdkError('CHANNEL_FULL');
      await realtime.presence.leave(player.id);
    },
    { expensive: true },
  );
  realtime.handle<Extract<RealtimeCommand, { type: 'map.move' }>>(
    'map.move',
    async (connection, command) => {
      await rooms.move(connection, command.x, command.y);
    },
    { coalesce: true },
  );
  realtime.handle('map.leave', async (connection) => {
    await rooms.leave(connection);
    await realtime.presence.leave(connection.identity.playerId);
  });
  realtime.onShutdown(rooms.close);
  realtime.onDisconnect(rooms.leave);
  realtime.onHeartbeat(rooms.touch);
}
