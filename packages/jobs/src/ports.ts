/** Infrastructure contracts only; payloads, business names and persistence belong to consumers. */
export type Job = { name: string; data: unknown };
export type JobSchedule = { everyMs: number } | { pattern: string; timeZone: string };
export interface JobQueue {
  schedule(id: string, schedule: JobSchedule, job: Job): Promise<void>;
  removeSchedule(id: string): Promise<void>;
  consume(handler: (job: Job) => Promise<void>, onError: (error: unknown) => void): Promise<void>;
  close(): Promise<void>;
}
