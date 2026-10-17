import type { Outfit } from '@chibi-town/character-core/character-types';

/** Metadata only attached to shared tables; practice saves keep their existing snapshots. */
export type TableSnapshot<Step> = {
  players?: { id: string; name: string; username?: string | null; outfit?: Outfit }[];
  serverTime?: number;
  turnEndsAt?: number;
  lastSteps?: { revision: number; steps: Step[] };
};

/** Public gameplay labels use the display name; the handle remains account metadata. */
export function tablePlayerName(player: { name: string; username?: string | null } | undefined): string | undefined {
  return player?.name;
}
