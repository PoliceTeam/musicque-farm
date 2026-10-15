import { ApiSdkError, type MapChannelInput } from '@chibi-town/contracts';
import { createPlayerService as createPlayerRules } from '@chibi-town/game-service/player/player-service';
import { createWorldService as createWorldRules } from '@chibi-town/game-service/world/world-service';
import type { PlayerAccount } from '@/_utils/session-auth';
import type { Database } from '@/infrastructure/database/database';
import { type TransactionTrace, withPlayerDocument } from '@/modules/player';
import type { ChannelPresence } from '@/modules/world/channel-presence';

export function createWorldService(deps: { db: Database; clock: () => number; presence: ChannelPresence }) {
  const { db, clock, presence } = deps;

  async function rulesFor(player: PlayerAccount) {
    const population = await presence.population(player.id, clock());
    return createWorldRules({
      player,
      clock,
      live: true,

      channelPopulation: (mapId, id, capacity) => Math.min(capacity, population(mapId, id)),
    });
  }

  return {
    async getWorld(player: PlayerAccount, trace?: TransactionTrace) {
      const rules = await rulesFor(player);
      return withPlayerDocument(db, player.id, rules.getWorld(), trace);
    },

    async getChannels(player: PlayerAccount, input: MapChannelInput, trace?: TransactionTrace) {
      const rules = await rulesFor(player);
      const read = rules.getMapChannels(input);
      return withPlayerDocument(
        db,
        player.id,
        async (document) => {
          const directory = read(document);
          await presence.enter(player.id, directory.mapId, directory.currentChannelId, clock());
          return directory;
        },
        trace,
      );
    },

    joinChannel(player: PlayerAccount, input: MapChannelInput & { channelId: number }, trace?: TransactionTrace) {
      const mapId = input?.mapId;
      return presence.exclusive(typeof mapId === 'string' ? mapId : '', async () => {
        const rules = await rulesFor(player);
        const join = rules.joinMapChannel(input);
        return withPlayerDocument(
          db,
          player.id,
          async (document) => {
            const directory = join(document);
            const capacity = directory.channels.find((channel) => channel.id === directory.currentChannelId)!.capacity;
            if (!(await presence.claim(player.id, directory.mapId, directory.currentChannelId, capacity, clock())))
              throw new ApiSdkError('CHANNEL_FULL');
            return directory;
          },
          trace,
        );
      });
    },

    /** A socket needs channel and outfit from the same player document lock. */
    async getMapState(player: PlayerAccount, input: MapChannelInput) {
      const rules = await rulesFor(player);
      const channels = rules.getMapChannels(input);
      const self = createPlayerRules({ player, clock }).getPlayer();
      return withPlayerDocument(db, player.id, (document) => ({
        channelId: channels(document).currentChannelId,
        outfit: self(document).outfit,
      }));
    },
  };
}

export type WorldService = ReturnType<typeof createWorldService>;
