import { ApiSdkError } from '@chibi-town/contracts';
import { type JewelerSnapshot, validateJewelerCommand } from '@chibi-town/contracts/jeweler';
import { JEWELER_MATERIALS, type JewelerMaterialId } from '@chibi-town/game-content/jeweler';
import { type PlayerDocument, reservedArcadeCoins } from '../player-document.js';
import type { GameService } from '../service-types.js';

export function createJewelerService(): Pick<GameService, 'getJeweler' | 'executeJeweler'> {
  const snapshot = (document: PlayerDocument): JewelerSnapshot => ({
    revision: document.revision,
    coins: document.farm.coins,
    availableCoins: Math.max(0, document.farm.coins - reservedArcadeCoins(document)),
    gems: document.farm.gems,
    materials: Object.fromEntries(
      JEWELER_MATERIALS.map((m) => [m.id, document.jeweler?.materials[m.id] ?? 0]),
    ) as Record<JewelerMaterialId, number>,
  });

  return {
    getJeweler: () => snapshot,

    executeJeweler(input) {
      validateJewelerCommand(input);
      return (document) => {
        const state = document.jeweler ?? { materials: {}, receipts: {} };
        const fingerprint = JSON.stringify([input.type, input.materialId, input.count]);
        const prior = Object.hasOwn(state.receipts, input.requestId) ? state.receipts[input.requestId] : undefined;
        if (prior !== undefined) {
          if (prior !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
          return snapshot(document);
        }
        const material = JEWELER_MATERIALS.find((m) => m.id === input.materialId)!;
        const holdings = { ...state.materials };
        const owned = holdings[material.id] ?? 0;
        let coins = document.farm.coins;
        if (input.type === 'buy') {
          const cost = material.buy * input.count;
          if (coins - reservedArcadeCoins(document) < cost) throw new ApiSdkError('INSUFFICIENT_COINS');
          coins -= cost;
          holdings[material.id] = owned + input.count;
        } else if (input.type === 'sell') {
          if (owned < input.count) throw new ApiSdkError('NOT_ALLOWED', undefined, 'NOT_ENOUGH_MATERIALS');
          holdings[material.id] = owned - input.count;
          coins += material.sell * input.count;
        } else {
          if (!('recipe' in material)) throw new ApiSdkError('NOT_ALLOWED');
          const required = material.recipe.count * input.count;
          const available = holdings[material.recipe.material] ?? 0;
          if (available < required) throw new ApiSdkError('NOT_ALLOWED', undefined, 'NOT_ENOUGH_MATERIALS');
          holdings[material.recipe.material] = available - required;
          holdings[material.id] = owned + input.count;
        }
        if (
          !Number.isSafeInteger(coins) ||
          coins < 0 ||
          Object.values(holdings).some((n) => !Number.isSafeInteger(n) || n < 0)
        )
          throw new ApiSdkError('INVALID_COMMAND');
        const receipts = { ...state.receipts };
        Object.defineProperty(receipts, input.requestId, {
          value: fingerprint,
          enumerable: true,
          configurable: true,
          writable: true,
        });
        document.jeweler = { materials: holdings, receipts };
        document.farm.coins = coins;
        document.revision++;
        return snapshot(document);
      };
    },
  };
}
