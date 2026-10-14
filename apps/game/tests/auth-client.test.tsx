import { createGameSdk } from '@chibi-town/api-sdk';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import { ApiSdkError } from '@chibi-town/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { AuthError, createAuthClient } from '@/application/auth-client';
import { shouldShowGuestPrompt } from '@/application/auth-context';
import { createGameI18n } from '@/application/i18n/instance';
import { RegistrationCharacter } from '@/features/auth/_components/registration-character';
import { AuthDialog } from '@/features/auth/auth-dialog';

const player = { id: 'p1', name: 'Lan', username: 'lan', level: 1, guest: false };

function client(respond: (path: string, body?: unknown) => { status?: number; body: unknown } | Error) {
  const calls: { path: string; init?: RequestInit }[] = [];
  const auth = createAuthClient({
    baseUrl: 'https://api.test/api/',

    fetch: async (url, init) => {
      const path = String(url).replace('https://api.test/api', '');
      calls.push({ path, init });
      const result = respond(path, init?.body ? JSON.parse(String(init.body)) : undefined);
      if (result instanceof Error) throw result;
      return new Response(JSON.stringify(result.body), { status: result.status ?? 200 });
    },
  });
  return { auth, calls };
}

describe('auth client', () => {
  it('reads the session and sends the cookie with every call', async () => {
    const { auth, calls } = client(() => ({ body: { player, providers: { google: true } } }));
    expect(await auth.session()).toEqual({ player, providers: { google: true } });
    expect(calls[0]).toMatchObject({ path: '/auth/session', init: { method: 'GET', credentials: 'include' } });
    expect(auth.googleUrl).toBe('https://api.test/api/auth/google');
  });

  it('treats a signed-out session as a state, not an error', async () => {
    const { auth } = client(() => ({ body: { player: null, providers: {} } }));
    expect(await auth.session()).toEqual({ player: null, providers: { google: false } });
  });

  it('posts credentials as JSON and returns the player', async () => {
    const { auth, calls } = client((path) => ({ status: path === '/auth/register' ? 201 : 200, body: { player } }));
    expect(await auth.login({ email: 'a@b.test', password: 'secret-123' })).toEqual(player);
    expect(await auth.register({ email: 'a@b.test', password: 'secret-123', name: 'Lan', username: 'lan' })).toEqual(
      player,
    );
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({
      email: 'a@b.test',
      password: 'secret-123',
      name: 'Lan',
      username: 'lan',
    });
  });

  it('maps server codes and hides everything else behind NETWORK_ERROR', async () => {
    const code = (promise: Promise<unknown>) => promise.catch((error) => (error as AuthError).code);

    for (const known of ['INVALID_CREDENTIALS', 'INVALID_INPUT', 'EMAIL_TAKEN'] as const)
      expect(
        await code(client(() => ({ status: 400, body: { code: known } })).auth.login({ email: '', password: '' })),
      ).toBe(known);
    const failures = [
      () => ({ status: 500, body: { code: 'INTERNAL_ERROR' } }),
      () => new Error('offline'),
      () => ({ body: { player: { id: 1 } } }),
      () => ({ body: { player: null } }),
    ];
    for (const respond of failures)
      expect(await code(client(respond).auth.login({ email: '', password: '' }))).toBe('NETWORK_ERROR');
    expect(
      await client(() => new Error('offline'))
        .auth.session()
        .catch((error) => error),
    ).toBeInstanceOf(AuthError);
  });
});

it('the HTTP SDK reports an expired session once per rejected call', async () => {
  const onUnauthenticated = vi.fn();
  const sdk = createGameSdk({
    adapter: 'http',
    baseUrl: 'https://api.test/api',
    onUnauthenticated,

    fetch: async () => new Response('{"code":"UNAUTHENTICATED"}', { status: 401 }),
  });
  const error = await sdk.getInventory().catch((failure) => failure);
  expect(error).toBeInstanceOf(ApiSdkError);
  expect(error.code).toBe('UNAUTHENTICATED');
  expect(onUnauthenticated).toHaveBeenCalledTimes(1);
});

describe('account dialog', () => {
  const render = (props: { google: boolean; googleFailed?: boolean }) =>
    renderToStaticMarkup(
      <I18nextProvider i18n={createGameI18n()}>
        <AuthDialog onClose={() => {}} client={client(() => ({ body: {} })).auth} onSignedIn={() => {}} {...props} />
      </I18nextProvider>,
    );

  it('starts on register above the game with labelled fields and an option to keep playing', () => {
    const html = render({ google: false });
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('type="email"');
    expect(html).toContain('name="name"');
    expect(html).toContain('<dialog');
    expect(html).toContain('Chơi tiếp với tư cách khách');
    expect(html).toContain('role="tablist"');
    expect(html).not.toContain('/auth/google');
    expect(html).not.toContain('role="alert"');
    expect(html.match(/class="ui-form-field"/g)).toHaveLength(4);
    expect(html).not.toContain('Xem trước nhân vật');
    expect(html).not.toContain('Goku');
  });

  it('links to the Google flow and explains a failed return', () => {
    const html = render({ google: true, googleFailed: true });
    expect(html).toContain('href="https://api.test/api/auth/google"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Đăng nhập Google không thành công');
  });
});

it('starts a guest only when no session exists and deduplicates concurrent shell mounts', async () => {
  const { auth, calls } = client((path) => ({
    body:
      path === '/auth/session' ? { player: null, providers: { google: true } } : { player: { ...player, guest: true } },
  }));
  const [first, second] = await Promise.all([auth.start(), auth.start()]);
  expect(first).toEqual(second);
  expect(first.player?.guest).toBe(true);
  expect(calls.map((call) => call.path)).toEqual(['/auth/session', '/auth/guest']);
  expect(calls[1].init).toMatchObject({ method: 'POST', credentials: 'include', body: '{}' });
  const existing = client(() => ({ body: { player } }));
  await existing.auth.start();
  expect(existing.calls).toHaveLength(1);
});
it('prompts once per browser session and tolerates unavailable storage', () => {
  let value: string | null = null;
  const storage = {
    getItem: () => value,

    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
  expect(shouldShowGuestPrompt(storage)).toBe(true);
  expect(shouldShowGuestPrompt(storage)).toBe(false);
  expect(
    shouldShowGuestPrompt({
      ...storage,

      getItem() {
        throw new Error('denied');
      },
    }),
  ).toBe(true);
});

it('posts usernames and display-name changes, and preserves the rename retry time', async () => {
  const { auth, calls } = client(() => ({ body: { player } }));
  await auth.setUsername('lan');
  await auth.rename('Tên mới');
  expect(calls.map((call) => [call.path, JSON.parse(String(call.init?.body))])).toEqual([
    ['/auth/username', { username: 'lan' }],
    ['/player/name', { name: 'Tên mới' }],
  ]);
  const nextAllowedAt = 1_700_604_800_000;
  const failure = await client(() => ({ status: 429, body: { code: 'RENAME_TOO_SOON', nextAllowedAt } }))
    .auth.rename('Another')
    .catch((error) => error);
  expect(failure).toMatchObject({ code: 'RENAME_TOO_SOON', nextAllowedAt });
  for (const code of ['USERNAME_TAKEN', 'USERNAME_IMMUTABLE', 'TOO_MANY_ATTEMPTS'] as const) {
    await expect(client(() => ({ status: 409, body: { code } })).auth.setUsername('lan')).rejects.toMatchObject({
      code,
    });
  }
});

it('accepts a username in the same login field and rejects malformed account handles', async () => {
  const { auth, calls } = client(() => ({ body: { player } }));
  await auth.login({ email: 'LAN', password: 'correct horse' });
  expect(JSON.parse(String(calls[0].init?.body))).toEqual({ email: 'LAN', password: 'correct horse' });
  await expect(client(() => ({ body: { player: { ...player, username: 123 } } })).auth.session()).rejects.toMatchObject(
    { code: 'NETWORK_ERROR' },
  );
});

it('requires the Google username step in the same popup and displays the registration reward', () => {
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <AuthDialog
        client={client(() => ({ body: {} })).auth}
        google
        usernameRequired
        registrationBonus
        onClose={() => {}}
        onSignedIn={() => {}}
      />
    </I18nextProvider>,
  );
  expect(html).toContain('Chọn username');
  expect(html).toContain('name="username"');
  expect(html).toContain('Bạn nhận 100.000 xu và 20 lượng');
  expect(html).not.toContain('name="password"');
  expect(html).not.toContain('Chơi tiếp với tư cách khách');
  expect(html).not.toContain('ui-icon-button');
  expect(html).not.toContain('/auth/google');
});

it('shows a registration confirmation with a button to enter the game', () => {
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <AuthDialog
        client={client(() => ({ body: {} })).auth}
        google={false}
        registrationBonus
        confirmationPlayer={player}
        onClose={() => {}}
        onSignedIn={() => {}}
      />
    </I18nextProvider>,
  );
  expect(html).toContain('Bạn nhận 100.000 xu và 20 lượng');
  expect(html).toContain('Vào chơi');
  expect(html).not.toContain('name="password"');
});

it('provides a labelled display-name popup for guests too', async () => {
  const { RenameDialog } = await import('@/features/auth/rename-dialog');
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <RenameDialog
        client={client(() => ({ body: {} })).auth}
        player={{ ...player, guest: true, username: null }}
        onClose={() => {}}
        onSaved={() => {}}
      />
    </I18nextProvider>,
  );
  expect(html).toContain('Đổi tên hiển thị');
  expect(html).toContain('name="name"');
  expect(html).toContain('value="Lan"');
  expect(html).toContain('minLength="2"');
  expect(html).toContain('maxLength="20"');
});

it('validates each auth field and allows registration without email', async () => {
  const { validateAuthField: validate } = await import('@/features/auth/_utils/validate-auth');
  expect(validate('email', '', 'register')).toBeUndefined();
  expect(validate('email', '', 'login')).toBe('required');
  expect(validate('email', 'invalid', 'register')).toBe('email');
  expect(validate('name', 'x', 'register')).toBe('name');
  expect(validate('password', 'short', 'register')).toBe('password');
  for (const username of ['ab', '.abc', '_abc', 'a b', 'x'.repeat(21)])
    expect(validate('username', username, 'register')).toBe('username');
  for (const username of ['abc', '0abc', 'a_b.c', 'ABC'])
    expect(validate('username', username, 'register')).toBeUndefined();
});

it('renders a login entry with password visibility control and no explanatory paragraphs', () => {
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <AuthDialog
        entry
        google={false}
        client={client(() => ({ body: {} })).auth}
        onClose={() => {}}
        onSignedIn={() => {}}
      />
    </I18nextProvider>,
  );
  expect(html).toContain('Đăng nhập Chibi Town');
  expect(html).toContain('current-password');
  expect(html).toContain('Hiện mật khẩu');
  expect(html).toContain('ui-field-required');
  expect(html).not.toContain('Tiến độ khách không được chuyển');
  expect(html).not.toContain('Tài khoản khách chỉ dùng');
  expect(html).not.toContain('name="name"');
});

it('opens character setup only for a pending account after signup', () => {
  const render = (pending: boolean) =>
    renderToStaticMarkup(
      <I18nextProvider i18n={createGameI18n()}>
        <AuthDialog
          google={false}
          client={client(() => ({ body: {} })).auth}
          confirmationPlayer={{ ...player, characterSetupRequired: pending }}
          onClose={() => {}}
          onSignedIn={() => {}}
        />
      </I18nextProvider>,
    );

  expect(render(true)).toContain('Đang tải nhân vật');
  expect(render(true)).not.toContain('Màu tóc');
  expect(render(true)).not.toContain('Cấp tóc');
  expect(render(true)).not.toContain('Goku');
  expect(render(true)).toContain('Lưu nhân vật và vào chơi');
  expect(render(true)).not.toContain('name="password"');
  expect(render(false)).not.toContain('Xem trước nhân vật');
});

it('shows exactly the eight basic appearance choices without special gear', () => {
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createGameI18n()}>
      <RegistrationCharacter outfit={{ ...defaultOutfit }} onChange={() => {}} disabled={false} />
    </I18nextProvider>,
  );
  expect(html.match(/<label/g)).toHaveLength(8);
  expect(html).toContain('Xem trước nhân vật');
  expect(html).not.toContain('Goku');
  expect(html).not.toContain('Cấp tóc');
  expect(html).not.toContain('Ủng');
});
