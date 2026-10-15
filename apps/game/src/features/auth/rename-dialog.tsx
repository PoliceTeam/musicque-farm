import { Button, Dialog, FormField } from '@chibi-town/ui/react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type AuthClient, AuthError, type AuthPlayer } from '@/application/auth-client';

export function RenameDialog({
  client,
  player,
  onClose,
  onSaved,
}: {
  client: AuthClient;
  player: AuthPlayer;
  onClose: () => void;
  onSaved: (player: AuthPlayer) => void;
}) {
  const { t, i18n } = useTranslation('auth');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '');
    setBusy(true);
    setError(undefined);
    try {
      onSaved(await client.rename(name));
    } catch (failure) {
      setError(failure instanceof AuthError ? failure : new AuthError('NETWORK_ERROR'));
      setBusy(false);
    }
  }

  return (
    <Dialog title={t('rename')} onClose={onClose} closeLabel={t('close')}>
      <form className="ui-stack" onSubmit={submit}>
        <FormField label={t('name')}>
          <input name="name" required minLength={2} maxLength={20} defaultValue={player.name} autoComplete="nickname" />
        </FormField>
        {error && (
          <p role="alert">
            {t(`errors.${error.code}`)}{' '}
            {error.nextAllowedAt !== undefined &&
              t('renameNext', { date: new Date(error.nextAllowedAt).toLocaleString(i18n.language) })}
          </p>
        )}
        <Button type="submit" busy={busy} busyLabel={t('busy')}>
          {t('saveName')}
        </Button>
      </form>
    </Dialog>
  );
}
