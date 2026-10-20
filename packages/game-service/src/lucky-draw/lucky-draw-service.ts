import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import { type LuckyDrawSnapshot, validateLuckyDrawCommand } from '@chibi-town/contracts/lucky-draw';
import {
  LUCKY_DRAW_ID,
  LUCKY_DUPLICATE_COINS,
  LUCKY_EXCLUSIVE_ITEMS,
  LUCKY_PRIZES,
  LUCKY_TICKET_PRICE,
} from '@chibi-town/game-content/lucky-draw';
import { ensureCharacterInventory, grantCharacterCosmetics } from '../inventory/cosmetic-grants.js';
import { own } from '../inventory/inventory-state.js';
import { type PlayerDocument, reservedArcadeCoins } from '../player-document.js';
import type { GameService, GameServiceOptions } from '../service-types.js';

export function createLuckyDrawService(
  options: GameServiceOptions,
): Pick<GameService, 'getLuckyDraw' | 'executeLuckyDraw'> {
  const snapshot = (document: PlayerDocument): LuckyDrawSnapshot => {
    const inventory = ensureCharacterInventory(document, options.clock());
    return {
      revision: document.revision,
      coins: document.farm.coins,
      availableCoins: Math.max(0, document.farm.coins - reservedArcadeCoins(document)),
      gems: document.farm.gems,
      tickets: document.luckyDraw?.tickets ?? 0,
      outfit: structuredClone(document.outfit ?? defaultOutfit),
      ownedCosmetics: LUCKY_EXCLUSIVE_ITEMS.filter((id) => own(inventory, id)),
      history: Object.values(document.luckyDraw?.receipts ?? {})
        .flatMap((record) => (record.result ? [record.result] : []))
        .slice(-10)
        .reverse()
        .map((result) => ({ ...result })),
    };
  };

  return {
    getLuckyDraw: () => snapshot,

    executeLuckyDraw(input) {
      validateLuckyDrawCommand(input);
      return (document) => {
        const state = document.luckyDraw ?? { tickets: 0, receipts: {} };
        const fingerprint = JSON.stringify(
          input.type === 'spin' ? [input.type, input.drawId] : [input.type, input.count],
        );
        const prior = Object.hasOwn(state.receipts, input.requestId) ? state.receipts[input.requestId] : undefined;
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
          return { ...snapshot(document), ...(prior.result ? { result: { ...prior.result } } : {}) };
        }
        const now = options.clock();
        let result: NonNullable<LuckyDrawSnapshot['result']> | undefined;
        if (input.type === 'buy-tickets') {
          const cost = input.count * LUCKY_TICKET_PRICE;
          if (document.farm.coins - reservedArcadeCoins(document) < cost) throw new ApiSdkError('INSUFFICIENT_COINS');
          if (!Number.isSafeInteger(state.tickets + input.count)) throw new ApiSdkError('INVALID_COMMAND');
          state.tickets += input.count;
          document.farm.coins -= cost;
        } else {
          if (input.drawId !== LUCKY_DRAW_ID) throw new ApiSdkError('INVALID_COMMAND');
          if (state.tickets < 1) throw new ApiSdkError('NOT_ALLOWED', undefined, 'NO_DRAW_TICKET');
          const random = options.random?.() ?? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
          if (!Number.isFinite(random) || random < 0 || random >= 1) throw new ApiSdkError('INVALID_COMMAND');
          let remaining = random * LUCKY_PRIZES.reduce((sum, prize) => sum + prize.weight, 0);
          const prize = LUCKY_PRIZES.find((candidate) => {
            remaining -= candidate.weight;
            return remaining < 0;
          })!;
          const inventory = ensureCharacterInventory(document, now);
          const duplicate = prize.kind === 'cosmetic' && own(inventory, prize.cosmeticId);
          const coins = duplicate ? LUCKY_DUPLICATE_COINS : prize.kind === 'coins' ? prize.amount : 0;
          const tickets = state.tickets - 1 + (prize.kind === 'tickets' ? prize.amount : 0);
          if (!Number.isSafeInteger(document.farm.coins + coins) || !Number.isSafeInteger(tickets))
            throw new ApiSdkError('INVALID_COMMAND');
          if (prize.kind === 'cosmetic' && !duplicate)
            grantCharacterCosmetics(
              inventory,
              `lucky-draw/${input.requestId}`,
              [prize.cosmeticId],
              { kind: 'event', eventId: LUCKY_DRAW_ID, rewardId: prize.id },
              now,
            );
          state.tickets = tickets;
          document.farm.coins += coins;
          result = { requestId: input.requestId, prizeId: prize.id, spunAt: now, duplicate };
        }
        Object.defineProperty(state.receipts, input.requestId, {
          value: { fingerprint, ...(result ? { result } : {}) },
          enumerable: true,
          configurable: true,
          writable: true,
        });
        document.luckyDraw = state;
        document.revision++;
        return { ...snapshot(document), ...(result ? { result: { ...result } } : {}) };
      };
    },
  };
}
