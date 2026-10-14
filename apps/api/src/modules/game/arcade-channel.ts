import type { PlayerDocument } from '@chibi-town/game-service';

/** The channel of the street outside the arcade hall; every channel has its own rooms and tables. */
export const arcadeChannel = (document: PlayerDocument) => document.channelSelections?.['entertainment-street'] ?? 0;
