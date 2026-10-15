import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('../../apps/game/', import.meta.url));
const [task, ...args] = process.argv.slice(2);
const commands = {
  dev: [['next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '5173']],
  build: [['next', 'build', '--webpack']],
  typecheck: [['next', 'typegen'], ['tsc', '--noEmit']],
  test: [['node', '--test', '../../tools/runtime/map-assets.test.mjs'], ['vitest', 'run']],
};
if (!Object.hasOwn(commands, task)) throw new Error(`Unknown game task: ${task}`);
// Turbo supplies TURBO_HASH only inside a task. Direct pnpm calls enter the same graph first.
const steps = process.env.TURBO_HASH
  ? commands[task].map((command, index, all) => index === all.length - 1 ? [...command, ...args] : command)
  : [['pnpm', '--workspace-root', 'exec', 'turbo', 'run', task, '--filter=@chibi-town/game', ...(args.length ? ['--', ...args] : [])]];
for (const [command, ...commandArgs] of steps) {
  const result = spawnSync(command, commandArgs, { cwd: app, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.signal) process.kill(process.pid, result.signal);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
