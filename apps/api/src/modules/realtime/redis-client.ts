/** The small subset of node-redis used by the coordination adapter. Keeps its large generic types private. */
export interface RedisClient {
  duplicate(): RedisClient;
  connect(): Promise<unknown>;
  close(): Promise<unknown>;
  on(event: 'error', listener: (error: unknown) => void): void;
  subscribe(channel: string, listener: (message: string) => void): Promise<unknown>;
  publish(channel: string, message: string): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { PX?: number; NX?: boolean }): Promise<string | null>;
  del(key: string): Promise<unknown>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
  scanIterator(options: { MATCH: string; COUNT: number }): AsyncIterable<string[]>;
}

export async function openRedisClient(url: string): Promise<RedisClient> {
  const moduleName = 'redis';
  const { createClient } = (await import(moduleName)) as { createClient(options: { url: string }): RedisClient };
  return createClient({ url });
}
