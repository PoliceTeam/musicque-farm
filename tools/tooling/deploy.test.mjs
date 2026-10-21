import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const api = `sha256:${'1'.repeat(64)}`;
const web = `sha256:${'2'.repeat(64)}`;
const old = `sha256:${'3'.repeat(64)}`;

async function mockCommands(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'farm-deploy-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const log = path.join(directory, 'calls.jsonl');
  const docker = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.DEPLOY_TEST_LOG, JSON.stringify(['docker', ...args]) + '\\n');
const last = args.at(-1);
if (args[0] === 'image' && args[1] === 'inspect' && args.includes('--format')) {
  console.log(last.endsWith('rollback-20260922000000') ? '${old}' : last.startsWith('chibi-town-api:') ? '${api}' : '${web}');
}
if (args[0] === 'ps') console.log('container-stopped');
if (args[0] === 'inspect') console.log('${old}');
if (args[0] === 'image' && args[1] === 'ls') {
  console.log(last + ':latest\\n' + last + ':rollback-20261021000000\\n' + last + ':rollback-20260922000000\\n' + last + ':rollback-20260921000000\\n' + last + ':rollback-20260821000000\\nother-project:rollback-old');
}
if (args[0] === 'image' && args[1] === 'rm' && last === '${old}') process.exit(1);
`;
  await writeFile(path.join(directory, 'docker'), docker, { mode: 0o755 });
  await writeFile(
    path.join(directory, 'pnpm'),
    `#!${process.execPath}\nrequire('node:fs').appendFileSync(process.env.DEPLOY_TEST_LOG, JSON.stringify(['pnpm', ...process.argv.slice(2)]) + '\\n'); process.exit(42);\n`,
    { mode: 0o755 },
  );
  const env = { ...process.env, PATH: `${directory}:${process.env.PATH}`, DEPLOY_TEST_LOG: log };

  async function calls() {
    return (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
  }

  return { env, calls };
}

for (const [script, repositories, label] of [
  ['scripts/prune-farm-images.sh', ['chibi-town-api', 'chibi-town-web'], 'com.chibi-town.app=farm'],
  ['apps/sso/prune-images.sh', ['musicque-sso-keycloak', 'musicque-sso-tools'], 'com.musicque.project=sso'],
]) {
  test(`${script} preserves newest rollback, latest and stopped-container images within its project`, async (t) => {
    const mock = await mockCommands(t);
    const result = spawnSync('bash', [script], { cwd: root, env: mock.env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const calls = await mock.calls();
    const removed = calls.filter((call) => call[2] === 'rm').map((call) => call.at(-1));
    assert.deepEqual(removed, repositories.flatMap(repository => [
      `${repository}:rollback-20260921000000`, `${repository}:rollback-20260821000000`,
    ]));
    assert.ok(calls.every((call) => !call.includes('--force') || call[2] === 'prune'));
    assert.deepEqual(calls.at(-1), ['docker', 'image', 'prune', '--force', '--filter', `label=${label}`]);
    assert.match(result.stdout, /Giữ image có container sử dụng/);
  });
}

test('a failing pre-deploy check stops before build, upload or cleanup', async (t) => {
  const mock = await mockCommands(t);
  const result = spawnSync('bash', ['scripts/deploy.prod.sh', '--build-only'], {
    cwd: root,
    env: mock.env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 42, result.stderr);
  assert.deepEqual(await mock.calls(), [['docker', 'info'], ['pnpm', 'check']]);
});

test('Farm tags only the repository being built, including partial deployments', async () => {
  const source = await readFile(path.join(root, 'scripts/deploy.prod.sh'), 'utf8');
  const apiBlock = source.slice(source.indexOf('if [[ "$BUILD_API" == true ]]'), source.indexOf('if [[ "$BUILD_WEB" == true ]]'));
  const webBlock = source.slice(source.indexOf('if [[ "$BUILD_WEB" == true ]]'), source.indexOf('if [[ "$BUILD_ONLY" == true ]]'));
  assert.ok(apiBlock.includes('"chibi-town-api:rollback-$STAMP"'));
  assert.ok(!apiBlock.includes('"chibi-town-web:rollback-$STAMP"'));
  assert.ok(webBlock.includes('"chibi-town-web:rollback-$STAMP"'));
  assert.ok(!webBlock.includes('"chibi-town-api:rollback-$STAMP"'));
  assert.ok(source.includes('for file in $4; do\n  image=${file%.tar.gz}'));
});
