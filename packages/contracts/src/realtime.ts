import type { Outfit } from '@chibi-town/character-core/character-types';
import { sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import { ARCADE_GAMES, type ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import type { RacePhase } from './pet-racing.js';

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
  | { type: 'social.changed' }
  | { type: 'pet-race.changed'; roundId: string; phase: RacePhase }
  | { type: 'lobby'; gameId: ArcadeGameId }
  | { type: 'match'; gameId: ArcadeGameId }
  | { type: 'map.state'; mapId: string; channelId: number; players: MapPlayer[] }
  | { type: 'map.join'; player: MapPlayer }
  | { type: 'map.moves'; moves: { id: string; x: number; y: number }[] }
  | { type: 'map.leave'; id: string };
export type RealtimeCommand =
  | { type: 'social.watch' }
  | { type: 'pet-race.watch' }
  | { type: 'pet-race.unwatch' }
  | { type: 'lobby.watch'; gameId: ArcadeGameId }
  | { type: 'lobby.unwatch' }
  | { type: 'map.enter'; regionId: string; mapId: string; x: number; y: number }
  | { type: 'map.move'; x: number; y: number }
  | { type: 'map.leave' };
/** Local lifecycle notification; never decoded from a server message. Reload snapshots after reconnect. */
export type RealtimeNotification = RealtimeEvent | { type: 'reconnected' };
export interface GameRealtime {
  /** Commands sent while disconnected are dropped; `map.enter`, `lobby.watch` and `pet-race.watch` are replayed on reconnect. */
  send(command: RealtimeCommand): void;
  subscribe(listener: (event: RealtimeNotification) => void): () => void;
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
    case 'social.watch':
    case 'pet-race.watch':
    case 'pet-race.unwatch':
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
    case 'social.changed':
      return { type: 'social.changed' };
    case 'pet-race.changed':
      return /^race-\d{1,12}$/.test(event.roundId ?? '') &&
        ['betting', 'countdown', 'racing', 'results'].includes(event.phase)
        ? { type: event.type, roundId: event.roundId, phase: event.phase }
        : undefined;
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
    case 'map.moves':
      return Array.isArray(event.moves) &&
        event.moves.length <= 1000 &&
        event.moves.every((move) => move && id(move.id) && point(move))
        ? { type: event.type, moves: event.moves.map(({ id, x, y }) => ({ id, x, y })) }
        : undefined;
    case 'map.leave':
      return id(event.id) ? { type: event.type, id: event.id } : undefined;
    default:
      return undefined;
  }
}
