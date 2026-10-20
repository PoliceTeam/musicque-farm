import { ApiSdkError } from '@chibi-town/contracts';
import type { MapPlayer } from '@chibi-town/contracts/realtime';
import { resolveMap } from '@chibi-town/game-content';
import type { PlayerDocument } from '@chibi-town/game-service';
import type { RealtimeService } from '@chibi-town/realtime-core';

/** Coordinates come from the leased world room, never the upgrade HTTP payload. */
export function createJewelerAccess(rooms: RealtimeService['rooms']) {
  return async (playerId: string, document: PlayerDocument) => {
    const map = resolveMap('center', 'shopping-street');
    const npc = map?.layers?.find((layer) => layer.id === 'jeweler');
    const channel = document.channelSelections?.['shopping-street'] ?? 0;
    const members = await rooms.members<{ player: MapPlayer }>(`map:shopping-street:${channel}`);
    const player = members[playerId]?.player?.player;
    if (
      !npc ||
      !player ||
      !Number.isFinite(player.x) ||
      !Number.isFinite(player.y) ||
      Math.hypot(player.x - (npc.x + npc.width / 2), player.y - (npc.y + npc.height)) > 200
    )
      throw new ApiSdkError('NOT_NEAR_JEWELER');
  };
}
