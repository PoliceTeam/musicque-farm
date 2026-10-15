import { createPlayerDocument } from '@chibi-town/game-service';
import { expect, it, vi } from 'vitest';
import type { Database } from '@/infrastructure/database/database';
import { createArcadeService } from '@/modules/arcade/service';
import type { TableService } from '@/modules/arcade/tables';

const locked = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@/modules/player', () => ({
  withPlayerDocument: (...args: unknown[]) => locked.run(...args),

  withPlayerTransaction: (...args: unknown[]) => locked.run(...args),
}));

it('rechecks PvP seating after a concurrent sit commits before acquiring the practice document lock', async () => {
  const document = createPlayerDocument();
  let seated = false;
  let unlock!: () => void;
  const held = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  locked.run.mockImplementation(async (_db, _id, operation) => {
    await held;
    return operation(document, {});
  });
  const tables = { seatedMatchId: vi.fn(async () => (seated ? 'pvp-match' : undefined)) } as unknown as TableService;
  const service = createArcadeService({
    db: {} as Database,

    clock: () => 1000,

    tables,
  });
  const practice = service.start(
    { id: 'player', name: 'Player', level: 1, guest: false, username: 'player' },
    'tien-len',
    { roomId: 3, requestId: 'practice' },
  );
  // PvP owns the wallet lock first; its seat becomes visible when that transaction commits.
  const sit = Promise.resolve().then(() => {
    seated = true;
    unlock();
  });
  const results = await Promise.allSettled([practice, sit]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results[0]).toMatchObject({ status: 'rejected', reason: { code: 'MATCH_IN_PROGRESS' } });
  expect(document.tien?.activeMatch).toBeUndefined();
});
