import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const template = await readFile(new URL('.env.example', import.meta.url), 'utf8');
const env = template.replace(
  /^(SSO_(?:ADMIN_PASSWORD|DATABASE_PASSWORD|FARM_CLIENT_SECRET|MUSICQUE_CLIENT_SECRET|FARM_TOKEN_KEY|MUSICQUE_TOKEN_KEY))=$/gm,
  (_, key) => `${key}=${randomBytes(32).toString('hex')}`,
);
try {
  await writeFile(new URL('.env', import.meta.url), env, { mode: 0o600, flag: 'wx' });
  console.log('Đã tạo apps/sso/.env với bí mật riêng cho từng client. File không được commit.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('apps/sso/.env đã tồn tại; giữ nguyên cấu hình.');
}
