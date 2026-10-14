import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { Button, Dialog, FormField, Tabs } from '@chibi-town/ui/react';
import { type FormEvent, type InputHTMLAttributes, lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type AuthClient, AuthError, type AuthErrorCode, type AuthPlayer } from '@/application/auth-client';

import { type AuthField, type FieldErrors, validateAuthField } from './_utils/validate-auth';

const RegistrationCharacter = lazy(() =>
  import('./_components/registration-character').then((module) => ({ default: module.RegistrationCharacter })),
);

function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useTranslation('auth');
  const [visible, setVisible] = useState(false);
  return (
    <span className="ui-password-input">
      <input {...props} type={visible ? 'text' : 'password'} />
      <Button
        className="ui-password-toggle"
        aria-label={t(visible ? 'hidePassword' : 'showPassword')}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </Button>
    </span>
  );
}

type Mode = 'login' | 'register';

/** Optional account upgrade above the current game screen. */
export function AuthDialog({
  client,
  entry = false,
  onContinueGuest,
  google,
  googleFailed = false,
  usernameRequired = false,
  registrationBonus = false,
  confirmationPlayer,
  onSignedIn,
  onClose,
}: {
  onClose: () => void;
  entry?: boolean;
  onContinueGuest?: () => Promise<void>;
  client: AuthClient;
  google: boolean;
  googleFailed?: boolean;
  usernameRequired?: boolean;
  registrationBonus?: boolean;
  confirmationPlayer?: AuthPlayer;
  onSignedIn: (player: AuthPlayer) => void;
}) {
  const { t } = useTranslation('auth');
  const [mode, setMode] = useState<Mode>(entry ? 'login' : 'register');
  const [outfit, setOutfit] = useState({ ...(confirmationPlayer?.characterSetupOutfit ?? defaultOutfit) });
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<AuthPlayer | undefined>(
    (registrationBonus || confirmationPlayer?.characterSetupRequired) && !usernameRequired
      ? confirmationPlayer
      : undefined,
  );
  const [error, setError] = useState<AuthErrorCode | 'GOOGLE_FAILED' | undefined>(
    googleFailed ? 'GOOGLE_FAILED' : undefined,
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validateField(field: AuthField, value: string) {
    const key = validateAuthField(field, value, mode, usernameRequired);
    setFieldErrors((previous) => ({
      ...previous,
      [field]: key ? t(`validation.${key}` as 'validation.required') : undefined,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields: AuthField[] = usernameRequired
      ? ['username']
      : mode === 'login'
        ? ['email', 'password']
        : ['name', 'username', 'email', 'password'];
    const errors: FieldErrors = {};
    for (const field of fields) {
      const key = validateAuthField(field, String(form.get(field) ?? ''), mode, usernameRequired);
      if (key) errors[field] = t(`validation.${key}` as 'validation.required');
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      const first = event.currentTarget.elements.namedItem(Object.keys(errors)[0]);
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    setBusy(true);
    setError(undefined);
    try {
      const player = usernameRequired
        ? await client.setUsername(String(form.get('username') ?? ''))
        : mode === 'login'
          ? await client.login({ email, password })
          : await client.register({
              email: email || undefined,
              password,
              name: String(form.get('name') ?? ''),
              username: String(form.get('username') ?? ''),
            });
      if (player.characterSetupRequired || (mode === 'register' && !usernameRequired)) {
        setOutfit({ ...(player.characterSetupOutfit ?? defaultOutfit) });
        setConfirmed(player);
        setBusy(false);
      } else onSignedIn(player);
    } catch (failure) {
      const code = failure instanceof AuthError ? failure.code : 'NETWORK_ERROR';
      if (code === 'USERNAME_TAKEN' || code === 'EMAIL_TAKEN') {
        setFieldErrors({ [code === 'USERNAME_TAKEN' ? 'username' : 'email']: t(`errors.${code}`) });
      } else setError(code);
      setBusy(false);
    }
  }

  async function finishCharacter() {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const player = await client.completeCharacter(outfit);
      onSignedIn(player);
    } catch (failure) {
      setError(failure instanceof AuthError ? failure.code : 'NETWORK_ERROR');
      setBusy(false);
    }
  }

  async function continueGuest() {
    if (busy) return;
    if (!onContinueGuest) {
      onClose();
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onContinueGuest();
    } catch (failure) {
      setError(failure instanceof AuthError ? failure.code : 'NETWORK_ERROR');
      setBusy(false);
    }
  }

  return (
    <div className="game-ui">
      <Dialog
        className={confirmed?.characterSetupRequired ? 'auth-character-dialog' : undefined}
        title={t(
          confirmed?.characterSetupRequired
            ? 'character'
            : usernameRequired
              ? 'usernameTitle'
              : entry
                ? 'entryTitle'
                : 'title',
        )}
        onClose={
          entry || usernameRequired || confirmed?.characterSetupRequired
            ? undefined
            : confirmed
              ? () => onSignedIn(confirmed)
              : onClose
        }
        closeLabel={t('close')}
        tabs={
          !usernameRequired &&
          !confirmed && (
            <Tabs
              appearance="folder"
              label={t('modeLabel')}
              value={mode}
              items={(['register', 'login'] as const).map((id) => ({ id, label: t(`${id}Tab`) }))}
              onChange={(id) => {
                if (!busy) {
                  setMode(id as Mode);
                  setError(undefined);
                  setFieldErrors({});
                }
              }}
            />
          )
        }
        footer={
          confirmed ? (
            <Button
              variant="primary"
              busy={busy}
              busyLabel={t('busy')}
              onClick={() => (confirmed.characterSetupRequired ? void finishCharacter() : onSignedIn(confirmed))}
            >
              {t(confirmed.characterSetupRequired ? 'saveCharacter' : 'done')}
            </Button>
          ) : !usernameRequired ? (
            <Button disabled={busy} onClick={() => void continueGuest()}>
              {t('continueGuest')}
            </Button>
          ) : undefined
        }
      >
        {confirmed ? (
          <div className="ui-stack auth-character-step">
            <p role="status">{t('registrationBonus')}</p>
            {confirmed.characterSetupRequired && (
              <Suspense fallback={<p role="status">{t('loadingCharacter')}</p>}>
                <RegistrationCharacter outfit={outfit} onChange={setOutfit} disabled={busy} />
              </Suspense>
            )}
            {error && <p role="alert">{t(`errors.${error}`)}</p>}
          </div>
        ) : (
          <>
            {registrationBonus && <p role="status">{t('registrationBonus')}</p>}
            <form
              className="ui-stack"
              noValidate
              onSubmit={submit}
              onBlur={(event) => {
                const input = event.target;
                if (input instanceof HTMLInputElement) validateField(input.name as AuthField, input.value);
              }}
              onChange={(event) => {
                const input = event.target;
                if (input instanceof HTMLInputElement && fieldErrors[input.name as AuthField])
                  validateField(input.name as AuthField, input.value);
              }}
            >
              {!usernameRequired && mode === 'register' && (
                <FormField label={t('name')} required error={fieldErrors.name}>
                  <input name="name" required minLength={2} maxLength={20} autoComplete="nickname" />
                </FormField>
              )}
              {(usernameRequired || mode === 'register') && (
                <FormField label={t('username')} required error={fieldErrors.username}>
                  <input
                    name="username"
                    required
                    minLength={3}
                    maxLength={20}
                    pattern="[a-zA-Z0-9][a-zA-Z0-9_.]{2,19}"
                    autoComplete="username"
                  />
                </FormField>
              )}
              {!usernameRequired && (
                <>
                  <FormField
                    label={t(mode === 'login' ? 'identifier' : 'email')}
                    required={mode === 'login'}
                    error={fieldErrors.email}
                  >
                    <input
                      name="email"
                      type={mode === 'login' ? 'text' : 'email'}
                      required={mode === 'login'}
                      maxLength={254}
                      autoComplete={mode === 'login' ? 'username' : 'email'}
                    />
                  </FormField>
                  <FormField label={t('password')} required error={fieldErrors.password}>
                    <PasswordInput
                      name="password"
                      required
                      minLength={mode === 'register' ? 8 : undefined}
                      maxLength={200}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                  </FormField>
                </>
              )}
              {error && <p role="alert">{t(`errors.${error}`)}</p>}
              <Button type="submit" variant="primary" busy={busy} busyLabel={t('busy')}>
                {t(usernameRequired ? 'saveUsername' : mode)}
              </Button>
            </form>
            {!usernameRequired && google && (
              <>
                <p>{t('or')}</p>
                <a className="ui-button" href={client.googleUrl}>
                  {t('google')}
                </a>
              </>
            )}
          </>
        )}
      </Dialog>
    </div>
  );
}
