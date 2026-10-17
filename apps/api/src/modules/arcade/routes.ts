import type { ArcadeMemberCommand, ArcadeTableCommand, ArcadeTableSettings } from '@chibi-town/contracts/arcade-table';
import type { RaceBet } from '@chibi-town/contracts/pet-racing';
import type { ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import { tableGames } from '@chibi-town/game-service';
import type { FastifyInstance } from 'fastify';
import type { createArcadeController } from '@/modules/arcade/controller';
import type { ArcadePlay, ArcadeStart } from '@/modules/arcade/practice';

export function registerArcadeRoutes(app: FastifyInstance, controller: ReturnType<typeof createArcadeController>) {
  app.get('/arcade/pet-racing', controller.getPetRace);
  app.post<{ Body: RaceBet }>('/arcade/pet-racing/bet', controller.betPetRace);
  app.get('/arcade', (request) => controller.getLobby(request, 'diamonds'));
  for (const gameId of Object.keys(tableGames) as ArcadeGameId[]) {
    const path = ['chess', 'chinese-chess', 'bau-cua', 'slots'].includes(gameId)
      ? `/arcade/mini/${gameId}`
      : `/arcade/${gameId}`;
    if (gameId !== 'diamonds') app.get(path, (request) => controller.getLobby(request, gameId));
    app.post<{ Body: ArcadeStart }>(`${path}/start`, (request) => controller.start(request, gameId));
    app.post<{ Body: ArcadePlay }>(`${path}/play`, (request) => controller.play(request, gameId));
  }
  app.post<{ Body: ArcadeMemberCommand }>('/arcade/table/member', controller.updateMember);
  app.post<{ Body: ArcadeTableSettings }>('/arcade/table/configure', controller.configure);
  app.post<{ Body: ArcadeTableCommand }>('/arcade/table/leave', controller.leave);
}
