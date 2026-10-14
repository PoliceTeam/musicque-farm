import type { ArcadeTableCommand } from '@chibi-town/contracts/arcade-table';
import { Button, Dialog } from '@chibi-town/ui/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { guardTableBack } from '../_utils/table-navigation.js';
import { useArcadeHost } from '../host.js';
import type { TableInfo } from './table-settings.js';

export function useLeaveTable({
  gameId,
  playerId,
  match,
  refreshWallet,
  interceptNavigation = true,
  disabled = false,
}: {
  gameId: import('@chibi-town/contracts/arcade-table').ArcadeTableCommand['gameId'];
  match?: TableInfo;
  playerId?: string;
  refreshWallet: () => Promise<void>;
  interceptNavigation?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation('common');
  const { sdk, navigate } = useArcadeHost();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const action = useRef<(() => void) | undefined>(undefined);
  const input = useRef<ArcadeTableCommand | undefined>(undefined);
  const locked = useRef(false);
  const stake =
    match?.session?.settlement === 'house'
      ? (match.session.members?.find((m) => m.id === playerId)?.stake ?? match.session.stake)
      : (match?.session?.stake ?? 0);
  const atRisk = match?.status === 'playing' && match.session?.mode === 'wager' && !match.session.settled && stake > 0;

  async function leave() {
    if (!match || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    input.current ??= { gameId, matchId: match.id, revision: match.revision, requestId: crypto.randomUUID() };
    try {
      await sdk.leaveArcadeTable(input.current);
      input.current = undefined;
      await refreshWallet().catch(() => {});
      setOpen(false);
      action.current?.();
      action.current = undefined;
    } catch {
      setError(t('arcadeLeaveFailed'));
      setOpen(true);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  function request(done: () => void) {
    if (locked.current || disabled) return;
    action.current = done;
    if (atRisk) setOpen(true);
    else void leave();
  }

  const currentRequest = useRef(request);
  currentRequest.current = request;
  useEffect(() => {
    if (!match?.id || !interceptNavigation) return;
    return guardTableBack(window, (done) => currentRequest.current(done));
  }, [match?.id, interceptNavigation]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Match changes refresh the navigation handler; request uses the current match and state.
  useEffect(() => {
    if (!match || !interceptNavigation) return;

    const onLink = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(anchor.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      currentRequest.current(() => navigate(`${url.pathname}${url.search}${url.hash}`));
    };

    document.addEventListener('click', onLink, true);
    return () => document.removeEventListener('click', onLink, true);
  }, [match, interceptNavigation]);

  const cancel = () => {
    if (!busy && !input.current) {
      setOpen(false);
      action.current = undefined;
    }
  };

  const dialog = open ? (
    <Dialog
      title={t('arcadeLeaveTitle')}
      closeLabel={t('close')}
      onClose={cancel}
      footer={
        <>
          <Button disabled={busy || !!input.current} onClick={cancel}>
            {t('arcadeStay')}
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void leave()}>
            {t('arcadeConfirmLeave')}
          </Button>
        </>
      }
    >
      <p>{t(atRisk ? 'arcadeLeaveWarning' : 'arcadeLeaveRetry', { stake })}</p>
      {error && <p role="alert">{error}</p>}
    </Dialog>
  ) : null;
  return { request, dialog, busy };
}
