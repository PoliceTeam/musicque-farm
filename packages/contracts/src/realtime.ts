import type { Outfit } from '@chibi-town/character-core/character-types';
import { sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import { ARCADE_GAMES, type ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';

/** Another player standing in the same map channel. */
export type MapPlayer = {
  id: string;
  name: string;
  username?: string | null;
  level: number;
  outfit: Outfit;
  x: number;
  y: number;
};
/**
 * Server pushes. `lobby` and `match` carry no state: the client re-reads its own snapshot through the SDK, so
 * hidden information (other hands) never travels on a shared message.
 */
export type RealtimeEvent =
  | { type: 'lobby'; gameId: ArcadeGameId }
  | { type: 'match'; gameId: ArcadeGameId }
  | { type: 'map.state'; mapId: string; channelId: number; players: MapPlayer[] }
  | { type: 'map.join'; player: MapPlayer }
  | { type: 'map.move'; id: string; x: number; y: number }
  | { type: 'map.leave'; id: string };
export type RealtimeCommand =
  | { type: 'lobby.watch'; gameId: ArcadeGameId }
  | { type: 'lobby.unwatch' }
  | { type: 'map.enter'; regionId: string; mapId: string; x: number; y: number }
  | { type: 'map.move'; x: number; y: number }
  | { type: 'map.leave' };
export interface GameRealtime {
  /** Commands sent while disconnected are dropped; `map.enter` and `lobby.watch` are replayed on reconnect. */
  send(command: RealtimeCommand): void;
  subscribe(listener: (event: RealtimeEvent) => void): () => void;
  close(): void;
}

const gameId = (value: unknown): value is ArcadeGameId => ARCADE_GAMES.some((game) => game.id === value);

const id = (value: unknown): value is string => typeof value === 'string' && /^[-a-zA-Z0-9_]{1,80}$/.test(value);

const point = (value: { x?: unknown; y?: unknown }) =>
  [value.x, value.y].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100_000);

function mapPlayer(value: unknown): MapPlayer | undefined {
  const player = value as MapPlayer;
  if (
    !player ||
    !id(player.id) ||
    typeof player.name !== 'string' ||
    player.name.length > 40 ||
    !Number.isSafeInteger(player.level) ||
    !player.outfit ||
    typeof player.outfit !== 'object' ||
    !point(player)
  )
    return undefined;
  return { ...player, username: player.username ?? null, outfit: sanitizeOutfit(player.outfit) };
}

export function decodeRealtimeCommand(value: unknown): RealtimeCommand | undefined {
  const command = value as RealtimeCommand;
  if (!command || typeof command !== 'object') return undefined;
  switch (command.type) {
    case 'lobby.watch':
      return gameId(command.gameId) ? { type: command.type, gameId: command.gameId } : undefined;
    case 'lobby.unwatch':
    case 'map.leave':
      return { type: command.type };
    case 'map.enter':
      return id(command.regionId) && id(command.mapId) && point(command)
        ? { type: command.type, regionId: command.regionId, mapId: command.mapId, x: command.x, y: command.y }
        : undefined;
    case 'map.move':
      return point(command) ? { type: command.type, x: command.x, y: command.y } : undefined;
    default:
      return undefined;
  }
}

export function decodeRealtimeEvent(value: unknown): RealtimeEvent | undefined {
  const event = value as RealtimeEvent;
  if (!event || typeof event !== 'object') return undefined;
  switch (event.type) {
    case 'lobby':
    case 'match':
      return gameId(event.gameId) ? { type: event.type, gameId: event.gameId } : undefined;
    case 'map.state': {
      if (!id(event.mapId) || !Number.isSafeInteger(event.channelId) || !Array.isArray(event.players)) return undefined;
      const players = event.players.map(mapPlayer);
      return players.every((player) => player !== undefined)
        ? { type: event.type, mapId: event.mapId, channelId: event.channelId, players }
        : undefined;
    }
    case 'map.join': {
      const player = mapPlayer(event.player);
      return player ? { type: event.type, player } : undefined;
    }
    case 'map.move':
      return id(event.id) && point(event) ? { type: event.type, id: event.id, x: event.x, y: event.y } : undefined;
    case 'map.leave':
      return id(event.id) ? { type: event.type, id: event.id } : undefined;
    default:
      return undefined;
  }
}
