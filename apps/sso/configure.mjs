import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const env = Object.fromEntries(
  (await readFile(new URL('.env', import.meta.url), 'utf8'))
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)];
    }),
);
const clients = JSON.parse(await readFile(new URL('clients.json', import.meta.url), 'utf8'));
for (const { clientId, envPrefix, partners } of clients) {
  const app = clientId === 'musicque-farm' ? 'farm' : clientId;
  const targets = partners
    .map((partner) => {
      const definition = clients.find((item) => item.clientId === partner);
      const url = env[`${definition.envPrefix}_HANDOFF_ACCEPT`];
      if (!url) throw new Error(`Missing handoff URL for ${partner}`);
      return `${partner}=${url}`;
    })
    .join(',');
  const origins = partners
    .map((partner) => env[`${clients.find((item) => item.clientId === partner).envPrefix}_WEB_ORIGIN`])
    .filter(Boolean)
    .join(',');
  const content =
    `SSO_ISSUER=${env.SSO_URL}/realms/sso\nSSO_CLIENT_ID=${clientId}\nSSO_CLIENT_SECRET=${env[`${envPrefix}_CLIENT_SECRET`]}\nSSO_TOKEN_KEY=${env[`${envPrefix}_TOKEN_KEY`] || randomBytes(32).toString('hex')}\nSSO_HANDOFF_TARGETS=${targets}\nSSO_HANDOFF_ORIGINS=${origins}\n` +
    (app === 'farm'
      ? ''
      : `SSO_REDIRECT_URI=${env[`${envPrefix}_REDIRECT_URI`]}\nSSO_WEB_ORIGIN=${env[`${envPrefix}_WEB_ORIGIN`]}\n`);
  try {
    await writeFile(new URL(`.env.${app}`, import.meta.url), content, { mode: 0o600, flag: 'wx' });
    console.log(`Đã tạo apps/sso/.env.${app}; ghép vào môi trường backend tương ứng.`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`Giữ nguyên apps/sso/.env.${app} đã tồn tại.`);
  }
}
