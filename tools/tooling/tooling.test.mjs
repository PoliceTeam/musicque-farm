import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

function graph(...tasks) {
  return JSON.parse(execFileSync('pnpm', ['turbo', 'run', ...tasks, '--dry=json'], { cwd: root, encoding: 'utf8' })).tasks;
}

test('check does not build the Next application', () => {
  assert.ok(graph('lint', 'typecheck', 'test').every((task) => task.taskId !== '@chibi-town/game#build'));
});

test('packages whose tests consume their own dist wait for their own build', () => {
  const tasks = graph('test');
  for (const name of ['character-core', 'renderer-phaser']) {
    const task = tasks.find((entry) => entry.taskId === `@chibi-town/${name}#test`);
    assert.ok(task.dependencies.includes(`@chibi-town/${name}#build`));
  }
});

test('lint runs without building packages', () => {
  assert.ok(graph('lint').every((task) => task.task === 'lint'));
});

test('asset preparation is shared once by game tasks, without inline generators', () => {
  const tasks = graph('lint', 'typecheck', 'test', 'build', 'dev');
  const preparation = tasks.filter((task) => task.taskId === '@chibi-town/game#prepare-assets');
  assert.equal(preparation.length, 1);
  for (const name of ['typecheck', 'test', 'build', 'dev']) {
    const task = tasks.find((entry) => entry.taskId === `@chibi-town/game#${name}`);
    assert.ok(task.dependencies.includes(preparation[0].taskId), task.taskId);
    assert.doesNotMatch(task.command, /prepare-assets\.mjs/);
  }
});

test('asset cache restores generated modules and public images without hashing its own outputs', () => {
  const preparation = graph('prepare-assets').find((task) => task.taskId === '@chibi-town/game#prepare-assets');
  assert.equal(preparation.resolvedTaskDefinition.cache, true);
  assert.ok(Object.keys(preparation.inputs).every((name) => !name.includes('generated-')));
  for (const input of [
    '../../packages/ui/src/theme.css',
    '../../packages/arcade-games-react/src/theme.css',
    '../../tools/runtime/prepare-assets.mjs',
    '../../tools/runtime/build-map-assets.mjs',
    '../../tools/farm-runtime-assets.json',
    '../../tools/entertainment/assets.json',
    '../../tools/arcade/assets.json',
    'src/features/auth/auth.css',
    'src/assets/map/world-map.jpg',
  ]) assert.ok(Object.hasOwn(preparation.inputs, input), input);
  const cache = mkdtempSync(join(tmpdir(), 'game-assets-cache-'));
  const saved = [];
  const run = () => execFileSync('pnpm', [
    'turbo', 'run', 'prepare-assets', '--filter=@chibi-town/game', '--cache=local:rw', '--cache-dir', cache,
  ], { cwd: root, encoding: 'utf8' });
  try {
    run();
    const app = new URL('../../apps/game/', import.meta.url);
    const publicImage = readdirSync(new URL('public/chibi-assets/map/', app)).find((name) => name.endsWith('.webp'));
    assert.ok(publicImage);
    const outputs = [...preparation.outputs.filter((name) => name.endsWith('.ts')), `public/chibi-assets/map/${publicImage}`];
    assert.equal(outputs.length, 5);
    for (const name of outputs) {
      const file = new URL(name, app);
      saved.push([file, readFileSync(file)]);
      rmSync(file);
    }
    assert.match(run(), /Cached:\s+1 cached/);
    for (const [file, content] of saved) assert.deepEqual(readFileSync(file), content);
  } finally {
    for (const [file, content] of saved) writeFileSync(file, content);
    rmSync(cache, { recursive: true, force: true });
  }
});

test('API rebuild removes obsolete modules and emits runnable Node ESM imports', () => {
  const dist = new URL('../../apps/api/dist/', import.meta.url);
  const build = () => execFileSync('pnpm', ['--filter', '@chibi-town/api', 'build'], { cwd: root, stdio: 'pipe' });
  build();
  const normalOutput = readdirSync(dist, { recursive: true }).sort();
  const hadDbDirectory = existsSync(new URL('db/', dist));
  const stale = ['db/tooling-obsolete.js', 'application/command-routes.js'];
  for (const name of stale) assert.equal(existsSync(new URL(name, dist)), false, name);
  for (const name of stale) {
    const file = new URL(name, dist);
    mkdirSync(new URL('./', file), { recursive: true });
    writeFileSync(file, '// obsolete build output\n');
  }
  try {
    build();
    for (const name of stale) assert.equal(existsSync(new URL(name, dist)), false, name);
    assert.deepEqual(readdirSync(dist, { recursive: true }).sort(), normalOutput);
    assert.ok(existsSync(new URL('main.js', dist)));
    const app = readFileSync(new URL('app.js', dist), 'utf8');
    assert.doesNotMatch(app, /from ['"]@\//);
    assert.match(app, /from ['"]\.\/modules\/auth\/index\.js['"]/);
  } finally {
    for (const name of stale) rmSync(new URL(name, dist), { force: true });
    const dbDirectory = new URL('db/', dist);
    if (!hadDbDirectory && existsSync(dbDirectory) && readdirSync(dbDirectory).length === 0) rmdirSync(dbDirectory);
  }
});
