import type { Outfit } from '@chibi-town/character-core/character-types';

/** Metadata only attached to shared tables; practice saves keep their existing snapshots. */
export type TableSnapshot<Step> = {
  players?: { id: string; name: string; username?: string | null; outfit?: Outfit }[];
  serverTime?: number;
  turnEndsAt?: number;
  lastSteps?: { revision: number; steps: Step[] };
};

/** A repeated display name is disambiguated by the immutable account handle. */
export function tablePlayerName(player: { name: string; username?: string | null } | undefined): string | undefined {
  return player ? `${player.name}${player.username ? ` @${player.username}` : ''}` : undefined;
}
