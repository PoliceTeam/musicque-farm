import { tableGames } from '@chibi-town/game-service';
import type { FastifyInstance } from 'fastify';
import { expect, it } from 'vitest';
import type { createArcadeController } from '@/modules/arcade/controller';
import { registerArcadeRoutes } from '@/modules/arcade/routes';

it('derives registered game routes from tableGames', () => {
  const paths: string[] = [];
  const app = {
    get: (path: string) => paths.push(path),

    post: (path: string) => paths.push(path),
  };
  const chess = tableGames.chess;
  try {
    delete tableGames.chess;
    registerArcadeRoutes(app as unknown as FastifyInstance, {} as ReturnType<typeof createArcadeController>);
    expect(paths).not.toContain('/arcade/mini/chess/start');
    expect(paths).toContain('/arcade/phom/start');
    expect(paths).toContain('/arcade/tien-len/start');
  } finally {
    tableGames.chess = chess;
  }
});
