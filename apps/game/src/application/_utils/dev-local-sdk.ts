import { createBrowserRepository, createGameSdk, type LocalDocument, type LocalRepository } from '@chibi-town/api-sdk';

export type DevSettings = { timeScale: number; coins: number; gems: number };
type DevDocument = LocalDocument & { devClock?: { real: number; game: number; scale: number } };

export function devNumber(value: string | undefined, fallback: number, max: number) {
  const n = Number(value);
  return value !== undefined && Number.isSafeInteger(n) && n >= 1 && n <= max ? n : fallback;
}

/** Separate save and persistent clock: reloads and multiple tabs share the same test timeline. */
export function createDevLocalSdk(
  source: LocalRepository,
  settings: DevSettings,
  now = Date.now,
  repository: LocalRepository = createBrowserRepository({ name: 'chibi-town-progress-dev' }),
) {
  let gameTime = now();
  let initialSave: Promise<LocalDocument> | undefined;
  const prepared: LocalRepository = {
    async transaction(operation) {
      initialSave ??= source.transaction((document) => document);
      const initial = await initialSave;
      return repository.transaction((document) => {
        const dev = document as DevDocument;
        const real = now();
        if (!dev.devClock) {
          Object.assign(dev, structuredClone(initial));
          dev.farm.coins = Math.max(dev.farm.coins, settings.coins);
          dev.farm.gems = Math.max(dev.farm.gems, settings.gems);
          dev.devClock = { real, game: real, scale: settings.timeScale };
          dev.revision++;
        }
        const anchor = dev.devClock;
        gameTime = anchor.game + Math.max(0, real - anchor.real) * anchor.scale;
        if (anchor.scale !== settings.timeScale) dev.devClock = { real, game: gameTime, scale: settings.timeScale };
        return operation(dev);
      });
    },
  };
  return createGameSdk({
    adapter: 'local',
    repository: prepared,

    clock: () => gameTime,
  });
}
