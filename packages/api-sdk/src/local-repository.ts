import { sanitizeOutfit } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import { createPlayerDocument, normalizePlayerDocument, type PlayerDocument } from '@chibi-town/game-service';

/** The single-player save keeps its original public names. */
export type LocalDocument = PlayerDocument;
export const createLocalDocument = createPlayerDocument;
export interface LocalRepository {
  transaction<T>(operation: (document: LocalDocument) => T): Promise<T>;
}

export function createMemoryRepository(initial = createLocalDocument()): LocalRepository {
  let document = normalizePlayerDocument(structuredClone(initial));
  let queue: Promise<unknown> = Promise.resolve();
  return {
    transaction<T>(operation: (document: LocalDocument) => T) {
      const result = queue.then(() => {
        const next = structuredClone(document);
        const value = operation(next);
        document = next;
        return structuredClone(value);
      });
      queue = result.catch(() => {});
      return result;
    },
  };
}

/** Each read/command is one IndexedDB readwrite transaction, serialized across tabs. */
export function createBrowserRepository(
  options: { legacy?: () => unknown; legacyOutfit?: () => unknown; name?: string } = {},
): LocalRepository {
  let database: Promise<IDBDatabase> | undefined;

  function open() {
    if (database) return database;
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open(options.name ?? 'chibi-town-progress', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('progress');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        database = undefined;
        reject(new ApiSdkError('STORAGE_UNAVAILABLE'));
      };
    });
    return database;
  }

  return {
    async transaction<T>(operation: (document: LocalDocument) => T) {
      const db = await open();
      return new Promise<T>((resolve, reject) => {
        const transaction = db.transaction('progress', 'readwrite');
        const store = transaction.objectStore('progress');
        const request = store.get('player');
        let value: T;
        let failure: unknown;
        request.onsuccess = () => {
          try {
            const document = request.result as LocalDocument | undefined;
            if (document && document.version !== 1)
              throw new ApiSdkError('STORAGE_UNAVAILABLE', 'Unsupported save version');
            const next = normalizePlayerDocument(document ?? createLocalDocument(options.legacy?.()));
            next.outfit ??= sanitizeOutfit(options.legacyOutfit?.());
            value = operation(next);
            store.put(next, 'player');
          } catch (error) {
            failure = error;
            transaction.abort();
          }
        };
        transaction.oncomplete = () => resolve(structuredClone(value));
        transaction.onabort = transaction.onerror = () => reject(failure ?? new ApiSdkError('STORAGE_UNAVAILABLE'));
      });
    },
  };
}
