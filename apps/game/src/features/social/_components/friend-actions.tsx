import type { FriendAction, FriendState } from '@chibi-town/contracts/social';
import { Button } from '@chibi-town/ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function FriendActions({
  state,
  pending,
  onAction,
}: {
  state: FriendState;
  pending: boolean;
  onAction(action: FriendAction): void;
}) {
  const { t } = useTranslation('social');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const actions: FriendAction[] =
    state === 'none'
      ? ['request']
      : state === 'incoming'
        ? ['accept', 'decline']
        : state === 'outgoing'
          ? ['cancel']
          : ['remove'];
  return (
    <div className="social-actions">
      {confirmRemove && state === 'friends' ? (
        <>
          <span>{t('removeConfirm')}</span>
          <Button
            disabled={pending}
            onClick={() => {
              setConfirmRemove(false);
              onAction('remove');
            }}
          >
            {t('actions.remove')}
          </Button>
          <Button disabled={pending} onClick={() => setConfirmRemove(false)}>
            {t('keepFriend')}
          </Button>
        </>
      ) : (
        actions.map((action) => (
          <Button
            key={action}
            disabled={pending}
            onClick={() => {
              if (action === 'remove') setConfirmRemove(true);
              else onAction(action);
            }}
          >
            {t(`actions.${action}`)}
          </Button>
        ))
      )}
    </div>
  );
}
