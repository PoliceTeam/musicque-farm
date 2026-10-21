import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let failed = false;
for (const relative of process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['deploy/.env.prod', 'apps/sso/.env.prod']) {
  const example = readFileSync(`${root}/${relative}.example`, 'utf8');
  const required = [...example.matchAll(/^# REQUIRED: ([A-Z][A-Z0-9_]*)\s*$/gm)].map((match) => match[1]);
  let values = {};
  try {
    values = parseEnv(readFileSync(`${root}/${relative}`, 'utf8'));
  } catch {
    console.error(`${relative}: không đọc được file env`);
    failed = true;
  }
  for (const key of required) {
    if (!values[key]?.trim()) {
      console.error(`${relative}: thiếu/rỗng ${key}`);
      failed = true;
    }
  }
}
process.exitCode = failed ? 1 : 0;
if (!failed) console.log('Env production: đủ biến bắt buộc (không in giá trị).');
