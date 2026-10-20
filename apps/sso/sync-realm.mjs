// Applies the mutable realm settings to a running Keycloak. Realm import only runs once, so this is the
// source of truth for registration, user profile, clients, themes, Google and SMTP. Safe to re-run.
// Usage: node sync-realm.mjs [env file, default .env]
import { readFile } from 'node:fs/promises';

const envFile = process.argv[2]
  ? new URL(process.argv[2], `file://${process.cwd()}/`)
  : new URL('.env', import.meta.url);
const env = Object.fromEntries(
  (await readFile(envFile, 'utf8'))
    .split('\n')
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
);
const base = (process.env.SSO_ADMIN_URL || env.SSO_ADMIN_URL || env.SSO_URL).replace(/\/$/, '');
const realm = `${base}/admin/realms/sso`;

const token = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: env.SSO_ADMIN_USERNAME,
    password: env.SSO_ADMIN_PASSWORD,
  }),
}).then(async (response) => {
  if (!response.ok) throw new Error(`Keycloak admin login failed (${response.status})`);
  return (await response.json()).access_token;
});

async function api(path, init = {}) {
  const response = await fetch(`${realm}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status})`);
  return response.status === 204 || response.status === 201 ? null : response.json();
}

const smtp = env.SSO_SMTP_HOST
  ? {
      host: env.SSO_SMTP_HOST,
      port: env.SSO_SMTP_PORT || '587',
      from: env.SSO_SMTP_FROM,
      fromDisplayName: 'Chibi Town & Musicque',
      // SSO_SMTP_SECURE=true: implicit TLS (e.g. Gmail 465); otherwise STARTTLS (587).
      ssl: env.SSO_SMTP_SECURE === 'true' ? 'true' : 'false',
      starttls: env.SSO_SMTP_SECURE === 'true' ? 'false' : 'true',
      auth: env.SSO_SMTP_USER ? 'true' : 'false',
      user: env.SSO_SMTP_USER,
      password: env.SSO_SMTP_PASSWORD,
    }
  : {};

await api('', {
  method: 'PUT',
  body: {
    displayName: 'Chibi Town & Musicque',
    registrationAllowed: true,
    registrationEmailAsUsername: false,
    loginWithEmailAllowed: true,
    duplicateEmailsAllowed: false,
    resetPasswordAllowed: true,
    // Email stays optional; verification would block accounts without one.
    verifyEmail: false,
    rememberMe: true,
    ssoSessionIdleTimeout: 2592000,
    ssoSessionMaxLifespan: 7776000,
    editUsernameAllowed: false,
    bruteForceProtected: true,
    internationalizationEnabled: true,
    // Both apps are Vietnamese-only; a single locale also hides Keycloak's language picker.
    supportedLocales: ['vi'],
    defaultLocale: 'vi',
    loginTheme: 'chibi-farm',
    passwordPolicy: 'length(8) and notUsername',
    smtpServer: smtp,
  },
});

// Usernames must stay valid for imported Musicque accounts (dash, up to 24); Farm asks for its own
// game username when the SSO one does not fit its stricter rule.
const profile = await api('/users/profile');

const attribute = (name) => profile.attributes.find((item) => item.name === name);

attribute('username').validations = {
  length: { min: 3, max: 24 },
  pattern: {
    pattern: '^[a-z0-9][a-z0-9._-]{2,23}$',
    'error-message': 'Tên đăng nhập 3–24 ký tự: chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.',
  },
  'up-username-not-idn-homograph': {},
};
const email = attribute('email');
delete email.required;
const firstName = attribute('firstName');
firstName.displayName = '${firstName}';
firstName.validations = { length: { max: 40 }, 'person-name-prohibited-characters': {} };
delete firstName.required;
profile.attributes = profile.attributes.filter((item) => item.name !== 'lastName');
// Import writes farmUserId/musicqueUserId; keep them admin-only.
profile.unmanagedAttributePolicy = 'ADMIN_EDIT';
await api('/users/profile', { method: 'PUT', body: profile });

const definitions = JSON.parse(await readFile(new URL('clients.json', import.meta.url), 'utf8'));
const [management] = await api('/clients?clientId=realm-management');
const scopes = await api('/client-scopes');
for (const definition of definitions) {
  const { clientId, theme, envPrefix, partners } = definition;
  const redirect = env[`${envPrefix}_REDIRECT_URI`];
  const origin = env[`${envPrefix}_WEB_ORIGIN`];
  const webUrl = env[`${envPrefix}_WEB_URL`] || origin;
  let [client] = await api(`/clients?clientId=${encodeURIComponent(clientId)}`);
  if (!client) {
    if (!env[`${envPrefix}_CLIENT_SECRET`]) throw new Error(`Missing client secret for ${clientId}`);
    await api('/clients', {
      method: 'POST',
      body: { clientId, protocol: 'openid-connect', publicClient: false, secret: env[`${envPrefix}_CLIENT_SECRET`] },
    });
    [client] = await api(`/clients?clientId=${encodeURIComponent(clientId)}`);
  }
  await api(`/clients/${client.id}`, {
    method: 'PUT',
    body: {
      ...client,
      ...(env[`${envPrefix}_CLIENT_SECRET`] ? { secret: env[`${envPrefix}_CLIENT_SECRET`] } : {}),
      publicClient: false,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: true,
      serviceAccountsEnabled: true,
      redirectUris: [redirect, `${webUrl.replace(/\/$/, '')}/`],
      webOrigins: [new URL(origin).origin],
      attributes: {
        ...client.attributes,
        login_theme: theme,
        'post.logout.redirect.uris': `${new URL(origin).origin}/*`,
        'pkce.code.challenge.method': 'S256',
        'standard.token.exchange.enabled': 'true',
        'standard.token.exchange.enableRefreshRequestedTokenType': 'SAME_SESSION',
        'access.token.lifespan': '60',
      },
    },
  });
  const service = await api(`/clients/${client.id}/service-account-user`);
  const roles = await api(`/clients/${management.id}/roles`);
  const minimal = roles.filter((role) => ['manage-users', 'view-users', 'query-users'].includes(role.name));
  const assigned = await api(`/users/${service.id}/role-mappings/clients/${management.id}`);
  const excessive = assigned.filter((role) => !minimal.some((allowed) => allowed.id === role.id));
  if (excessive.length)
    await api(`/users/${service.id}/role-mappings/clients/${management.id}`, { method: 'DELETE', body: excessive });
  await api(`/users/${service.id}/role-mappings/clients/${management.id}`, { method: 'POST', body: minimal });
  for (const scope of scopes.filter((scope) => ['offline_access', 'profile'].includes(scope.name))) {
    await api(`/clients/${client.id}/${scope.name === 'profile' ? 'default' : 'optional'}-client-scopes/${scope.id}`, {
      method: 'PUT',
    });
  }
  const mappers = await api(`/clients/${client.id}/protocol-mappers/models`);
  for (const mapper of mappers.filter(
    (mapper) =>
      mapper.name.startsWith('handoff-audience-') &&
      ![clientId, ...partners].some((target) => mapper.name === `handoff-audience-${target}`),
  )) {
    await api(`/clients/${client.id}/protocol-mappers/models/${mapper.id}`, { method: 'DELETE' });
  }
  for (const target of [clientId, ...partners]) {
    const name = `handoff-audience-${target}`;
    const existing = mappers.find((mapper) => mapper.name === name);
    const body = {
      name,
      protocol: 'openid-connect',
      protocolMapper: 'oidc-audience-mapper',
      config: { 'included.client.audience': target, 'access.token.claim': 'true', 'id.token.claim': 'false' },
    };
    await api(`/clients/${client.id}/protocol-mappers/models${existing ? `/${existing.id}` : ''}`, {
      method: existing ? 'PUT' : 'POST',
      body,
    });
  }
}

const google = await api('/identity-provider/instances')
  .then((list) => list.find((item) => item.alias === 'google'))
  .catch(() => undefined);
if (env.SSO_GOOGLE_CLIENT_ID && env.SSO_GOOGLE_CLIENT_SECRET) {
  const body = {
    alias: 'google',
    providerId: 'google',
    displayName: 'Google',
    enabled: true,
    trustEmail: true,
    firstBrokerLoginFlowAlias: 'first broker login',
    config: { clientId: env.SSO_GOOGLE_CLIENT_ID, clientSecret: env.SSO_GOOGLE_CLIENT_SECRET, syncMode: 'IMPORT' },
  };
  await api(google ? '/identity-provider/instances/google' : '/identity-provider/instances', {
    method: google ? 'PUT' : 'POST',
    body,
  });
}

console.log(
  `Realm sso đã đồng bộ: đăng ký, hồ sơ, ${definitions.length} client/theme${env.SSO_GOOGLE_CLIENT_ID ? ', Google' : ''}${smtp.host ? ', SMTP' : ''}.`,
);
