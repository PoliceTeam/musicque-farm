'use client';
import type { Outfit } from '@chibi-town/character-core/character-types';
import type { GameSdk } from '@chibi-town/contracts';
import type { GameRealtime } from '@chibi-town/contracts/realtime';
import { type ComponentType, createContext, type ReactNode, useContext } from 'react';
export type ArcadeAvatarProps = { outfit: Outfit; mirror?: boolean; label: string };
export type ArcadeHost = {
  sdk: GameSdk;
  /** Live table and lobby events; absent when the game runs on a local save. */
  realtime?: GameRealtime;
  account?: { guest: boolean; request: () => void };
  assets: Readonly<Record<string, string>>;
  Avatar: ComponentType<ArcadeAvatarProps>;
  navigate: (url: string) => void;
};
const Context = createContext<ArcadeHost | undefined>(undefined);

export function ArcadeHostProvider({ host, children }: { host: ArcadeHost; children: ReactNode }) {
  return <Context.Provider value={host}>{children}</Context.Provider>;
}

export function useArcadeHost(): ArcadeHost {
  const host = useContext(Context);
  if (!host) throw new Error('ArcadeHostProvider is required');
  return host;
}
