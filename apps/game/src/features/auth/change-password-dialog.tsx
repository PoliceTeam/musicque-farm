import { Button, Dialog, FormField } from '@chibi-town/ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type AuthClient, AuthError, type AuthErrorCode } from '@/application/auth-client';

export function ChangePasswordDialog({ client, onClose }: { client: AuthClient; onClose: () => void }) {
  const { t } = useTranslation('auth');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<AuthErrorCode>();
  return (
    <Dialog title={t('changePassword')} onClose={onClose} closeLabel={t('close')}>
      <form
        className="ui-stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setError(undefined);
          try {
            await client.changePassword(String(data.get('currentPassword')), String(data.get('newPassword')));
            setDone(true);
          } catch (failure) {
            setError(failure instanceof AuthError ? failure.code : 'NETWORK_ERROR');
          } finally {
            setBusy(false);
          }
        }}
      >
        <FormField label={t('currentPassword')} required>
          <input name="currentPassword" type="password" autoComplete="current-password" required maxLength={200} />
        </FormField>
        <FormField label={t('newPassword')} required>
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={200}
          />
        </FormField>
        {error && <p role="alert">{t(`errors.${error}`)}</p>}
        {done && <p role="status">{t('passwordChanged')}</p>}
        <Button type="submit" busy={busy}>
          {t('changePassword')}
        </Button>
      </form>
    </Dialog>
  );
}
