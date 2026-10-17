import type { ArcadeMemberCommand, ArcadeTableCommand, ArcadeTableSettings } from '@chibi-town/contracts/arcade-table';
import type { RaceBet } from '@chibi-town/contracts/pet-racing';
import type { ArcadeGameId } from '@chibi-town/game-content/arcade-catalog';
import type { FastifyRequest } from 'fastify';
import { operationTrace } from '@/_utils/operation-trace';
import type { ArcadePlay, ArcadeStart } from '@/modules/arcade/practice';
import type { ArcadeService } from '@/modules/arcade/service';

export function createArcadeController(service: ArcadeService) {
  return {
    getPetRace(request: FastifyRequest) {
      return service.getPetRace(request.player!, operationTrace(request, 'arcade.pet-racing'));
    },

    betPetRace(request: FastifyRequest<{ Body: RaceBet }>) {
      return service.betPetRace(
        request.player!,
        request.body,
        operationTrace(request, 'arcade.pet-racing.bet', request.body?.requestId),
      );
    },

    getLobby(request: FastifyRequest, gameId: ArcadeGameId) {
      return service.getLobby(request.player!, gameId, operationTrace(request, `arcade.${gameId}.lobby`));
    },

    start(request: FastifyRequest<{ Body: ArcadeStart }>, gameId: ArcadeGameId) {
      return service.start(
        request.player!,
        gameId,
        request.body,
        operationTrace(request, `arcade.${gameId}.start`, request.body?.requestId),
      );
    },

    play(request: FastifyRequest<{ Body: ArcadePlay }>, gameId: ArcadeGameId) {
      return service.play(
        request.player!,
        gameId,
        request.body,
        operationTrace(request, `arcade.${gameId}.play`, request.body?.requestId),
      );
    },

    updateMember(request: FastifyRequest<{ Body: ArcadeMemberCommand }>) {
      return service.updateMember(
        request.player!,
        request.body,
        operationTrace(request, 'arcade.member', request.body?.requestId),
      );
    },

    configure(request: FastifyRequest<{ Body: ArcadeTableSettings }>) {
      return service.configure(
        request.player!,
        request.body,
        operationTrace(request, 'arcade.configure', request.body?.requestId),
      );
    },

    leave(request: FastifyRequest<{ Body: ArcadeTableCommand }>) {
      return service.leave(
        request.player!,
        request.body,
        operationTrace(request, 'arcade.leave', request.body?.requestId),
      );
    },
  };
}
