import type { Command, GameSdk, Snapshot } from '@chibi-town/api-sdk';
import { createStore } from 'zustand/vanilla';

export function createFarmStore(sdk: GameSdk, map = { regionId: 'farm', mapId: 'farm-home', instanceId: 'home' }) {
  const store = createStore<{
    snapshot?: Snapshot;
    player?: Awaited<ReturnType<GameSdk['getPlayer']>>;
    pending: boolean;
    error?: string;
  }>(() => ({ pending: false }));

  function apply(snapshot: Snapshot) {
    const previous = store.getState().snapshot;
    if (!previous || snapshot.revision >= previous.revision) store.setState({ snapshot, error: undefined });
  }

  let retry: { fingerprint: string; command: Command } | undefined;
  return {
    store,

    async refresh() {
      const [player, snapshot] = await Promise.all([store.getState().player ?? sdk.getPlayer(), sdk.getMap(map)]);
      store.setState({ player });
      apply(snapshot);
    },

    async execute(command: FarmCommand) {
      if (store.getState().pending) return undefined;
      store.setState({ pending: true, error: undefined });
      try {
        const fingerprint = JSON.stringify(command);
        if (!retry || retry.fingerprint !== fingerprint)
          retry = {
            fingerprint,
            command: {
              ...command,
              requestId: crypto.randomUUID(),
              mapInstanceId: store.getState().snapshot?.mapInstanceId ?? map.instanceId,
            } as Command,
          };
        const result = await sdk.execute(retry.command);
        retry = undefined;
        apply(result);
        return result;
      } catch (error) {
        store.setState({ error: error instanceof Error ? error.message : 'Không thể thực hiện thao tác.' });
        throw error;
      } finally {
        store.setState({ pending: false });
      }
    },
  };
}

export type FarmCommand = Command extends infer C
  ? C extends Command
    ? Omit<C, 'requestId' | 'mapInstanceId'>
    : never
  : never;
