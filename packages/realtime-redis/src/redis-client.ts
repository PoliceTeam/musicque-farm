/** Keeps node-redis's implementation types out of public ports. Both standalone and Cluster implement this subset. */
export interface RedisClient {
  duplicate(): RedisClient;
  connect(): Promise<unknown>;
  close(): Promise<unknown>;
  on(event: 'error', listener: (error: unknown) => void): void;
  subscribe(channel: string, listener: (message: string) => void): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  publish(channel: string, message: string): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { PX?: number; NX?: boolean }): Promise<string | null>;
  del(key: string): Promise<unknown>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

export async function openRedisClient(url: string, cluster = false): Promise<RedisClient> {
  const moduleName = 'redis';
  const redis = (await import(moduleName)) as {
    createClient(options: { url: string }): RedisClient;
    createCluster(options: { rootNodes: { url: string }[] }): RedisClient;
  };
  return cluster ? redis.createCluster({ rootNodes: [{ url }] }) : redis.createClient({ url });
}
