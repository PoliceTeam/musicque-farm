import { ApiSdkError } from '@chibi-town/contracts';
import { type FarmVisit, type StealFarmCrop, validateStealFarmCrop } from '@chibi-town/contracts/farm-social';
import type { SocialPlayer } from '@chibi-town/contracts/social';
import { canStoreFarmGoods, createFarmProgress, cropStage } from '@chibi-town/gameplay';
import type { PlayerDocument } from '../player-document.js';

/** Public scene projection never exposes the owner's wallet, seeds, warehouse or receipts. */
export function farmVisit(owner: SocialPlayer, document: PlayerDocument, now: number): FarmVisit {
  const farm = createFarmProgress();
  for (const key of ['owned', 'plots', 'units', 'capacity', 'animals', 'poultry', 'fish', 'fedAt'] as const)
    Object.assign(farm, { [key]: structuredClone(document.farm[key]) });
  farm.coins = 0;
  return {
    owner,
    snapshot: { mapInstanceId: 'home', revision: document.revision, serverTime: now, farm, outfit: owner.outfit },
  };
}

/** Caller locks and commits both documents together, and verifies mutual friendship. */
export function stealFarmCrop(
  visitor: SocialPlayer,
  visitorDocument: PlayerDocument,
  owner: SocialPlayer,
  ownerDocument: PlayerDocument,
  input: StealFarmCrop,
  now: number,
): FarmVisit {
  validateStealFarmCrop(input);
  if (visitor.id === owner.id || input.ownerId !== owner.id) throw new ApiSdkError('NOT_ALLOWED');
  const fingerprint = JSON.stringify(['steal-farm-crop', input.ownerId, input.index, input.wateredAt]);
  const prior = Object.hasOwn(visitorDocument.requests, input.requestId)
    ? visitorDocument.requests[input.requestId]
    : undefined;
  if (prior) {
    if (prior.fingerprint !== fingerprint) throw new ApiSdkError('REQUEST_CONFLICT');
    return farmVisit(owner, ownerDocument, now);
  }
  const crop = ownerDocument.farm.plots[input.index];
  if (
    input.index >= ownerDocument.farm.owned ||
    !crop ||
    crop.stolen ||
    crop.wateredAt !== input.wateredAt ||
    cropStage(crop, now) !== 'ripe'
  )
    throw new ApiSdkError('NOT_ALLOWED');
  const cropId = crop.cropId ?? 'strawberry';
  if (!canStoreFarmGoods(visitorDocument.farm, { [cropId]: 1 })) throw new ApiSdkError('INVENTORY_FULL');
  visitorDocument.farm.inventory[cropId] = (visitorDocument.farm.inventory[cropId] ?? 0) + 1;
  crop.stolen = true;
  ownerDocument.farmTheftHistory = [
    { visitorId: visitor.id, visitorName: visitor.name, cropId, index: input.index, at: now },
    ...(ownerDocument.farmTheftHistory ?? []),
  ].slice(0, 100);
  visitorDocument.revision++;
  ownerDocument.revision++;
  Object.defineProperty(visitorDocument.requests, input.requestId, {
    value: { fingerprint, result: { completed: 1, eligible: 1 } },
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return farmVisit(owner, ownerDocument, now);
}
