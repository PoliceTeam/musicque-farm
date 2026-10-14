import type { GameSdk } from '@chibi-town/contracts';
import { createHttpSdk } from './http-adapter.js';
import { createLocalSdk } from './local-adapter.js';

export type {
  ChannelDirectory,
  Command,
  CommandResult,
  GameSdk,
  MapChannelInput,
  Snapshot,
} from '@chibi-town/contracts';
export { ApiSdkError } from '@chibi-town/contracts';
export * from './local-repository.js';
export { createRealtimeClient } from './realtime-client.js';
export { createHttpSdk, createLocalSdk };

export function createGameSdk(
  config:
    | ({ adapter: 'local' } & Parameters<typeof createLocalSdk>[0])
    | ({ adapter: 'http' } & Parameters<typeof createHttpSdk>[0]),
): GameSdk {
  return config.adapter === 'local' ? createLocalSdk(config) : createHttpSdk(config);
}

export type { ArcadeLobby, DiamondCommand } from '@chibi-town/contracts/arcade';
