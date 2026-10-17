import type { Job, JobQueue } from '@chibi-town/jobs';
import type { RealtimePublisher } from '@chibi-town/realtime-core';
import type { PetRaceResetConfig } from '@/config';
import { type createSharedPetRacingService, PET_RACE_TOPIC } from '@/modules/arcade/pet-racing';
import type { TableService } from '@/modules/arcade/tables';

export const BACKGROUND_JOBS = {
  phase: 'pet-race-phase',
  settle: 'pet-race-settle',
  reset: 'pet-race-reset',
  tables: 'arcade-table-sweep',
} as const;

/** Application composition only: queue transport and game rules stay independent. */
export function createBackgroundJobs(deps: {
  queue: JobQueue;
  races: ReturnType<typeof createSharedPetRacingService>;
  tables: Pick<TableService, 'sweep'>;
  publisher: RealtimePublisher;
  reset: PetRaceResetConfig;
  onError(error: unknown): void;
}) {
  async function handle(job: Job) {
    if (!job.data || typeof job.data !== 'object' || Array.isArray(job.data) || Object.keys(job.data).length)
      throw new Error('Invalid background job payload');
    switch (job.name) {
      case BACKGROUND_JOBS.phase: {
        const event = await deps.races.phaseChange();
        if (event) await deps.publisher.publish(PET_RACE_TOPIC, event);
        break;
      }
      case BACKGROUND_JOBS.settle:
        await deps.races.sweep();
        break;
      case BACKGROUND_JOBS.reset:
        await deps.races.initialize();
        break;
      case BACKGROUND_JOBS.tables:
        await deps.tables.sweep();
        break;
      default:
        throw new Error(`Unknown background job: ${job.name}`);
    }
  }

  return {
    handle,

    async start() {
      // Persisted pending bets and reset-day markers recover work missed during downtime or Redis loss.
      await deps.races.initialize();
      await deps.races.sweep();
      await handle({ name: BACKGROUND_JOBS.phase, data: {} });
      await deps.queue.consume(handle, deps.onError);
      await deps.queue.schedule(BACKGROUND_JOBS.phase, { everyMs: 1000 }, { name: BACKGROUND_JOBS.phase, data: {} });
      for (const name of [BACKGROUND_JOBS.settle, BACKGROUND_JOBS.tables])
        await deps.queue.schedule(name, { everyMs: 5000 }, { name, data: {} });
      if (deps.reset.enabled) {
        const [hour, minute] = deps.reset.time.split(':').map(Number);
        await deps.queue.schedule(
          BACKGROUND_JOBS.reset,
          { pattern: `${minute} ${hour} * * *`, timeZone: deps.reset.timeZone },
          { name: BACKGROUND_JOBS.reset, data: {} },
        );
      } else await deps.queue.removeSchedule(BACKGROUND_JOBS.reset);
    },

    close: () => deps.queue.close(),
  };
}
