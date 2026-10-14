import { ApiSdkError, type GameSdk } from '@chibi-town/contracts';

/** The host owns account UI; games keep consuming the same SDK contract. */
export function accountRequiredSdk(sdk: GameSdk, onAccountRequired: () => void): GameSdk {
  return new Proxy(sdk, {
    get(target, key) {
      const method = Reflect.get(target, key);
      if (typeof method !== 'function') return method;
      return (...args: unknown[]) =>
        Promise.resolve(Reflect.apply(method, target, args)).catch((failure: unknown) => {
          if (failure instanceof ApiSdkError && failure.code === 'ACCOUNT_REQUIRED') onAccountRequired();
          throw failure;
        });
    },
  });
}
