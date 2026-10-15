/**
 * Disposable notifications only: at-most-once, ordered per connection on a live transport.
 * There is no replay or ordering across publishers. Clients MUST reload snapshots after reconnect.
 * Money, cards and inventory stay on HTTP + PostgreSQL + game-service, never in this store/bus.
 */
export type ConnectionId = string;
export type Event = { type: string };
export type Identity = { playerId: string; sessionId: string; expiresAt: number; context: unknown };
export interface Connection {
  id: ConnectionId;
  identity: Identity;
  bufferedAmount: number;
  send(serialized: string): void;
  close(code: number): void;
  terminate(): void;
  ping(): void;
  onMessage(listener: (raw: string) => void): void;
  onPong(listener: () => void): void;
  onClose(listener: () => void): void;
}
export interface Transport {
  accept(listener: (connection: Connection) => void): () => void;
}
/** Subscribe resolves only once the subscription is ready; an unsubscribe must finish before reusing a topic. */
export interface Bus {
  publish(topic: string, serialized: string): Promise<void>;
  subscribe(topic: string, listener: (serialized: string) => void): Promise<() => Promise<void>>;
}
/** Small KV/lock port for authentication attempts and per-player room transitions; never a global room lock. */
export interface Coordination {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exclusive<T>(key: string, task: () => Promise<T>): Promise<T>;
}
export type RoomMember<T = unknown> = { owner: ConnectionId; player: T };
/**
 * All owner mutations are atomic and reject superseded owners. Updates/heartbeats also reject expired leases;
 * removal may clean an expired member when its owner still matches.
 * A single logical connection lease has one deadline, replicated into room/population and connection indexes.
 * Moves update data, never extend that lease. HTTP reservations use the same room index without drawing data.
 * Room capacity counts distinct player IDs, including reservations; snapshots omit reservation-only values.
 */
export interface Store {
  claim(
    topic: string,
    playerId: string,
    member: RoomMember,
    capacity: number,
    now: number,
    until: number,
  ): Promise<boolean>;
  update(topic: string, playerId: string, member: RoomMember, now: number): Promise<boolean>;
  remove(topic: string, playerId: string, owner: string): Promise<boolean>;
  members<T>(topic: string, now: number): Promise<Record<string, RoomMember<T>>>;
  touch(topic: string, playerId: string, owner: string, now: number, until: number): Promise<boolean>;
  /** Atomic per-room tick: returns latest changes once across all instances; undefined retains changes until due.
   * This is disposable at-most-once delivery: a publisher crash after taking a batch may lose that notification.
   */
  takeChanges<T>(topic: string, now: number, intervalMs: number): Promise<Record<string, RoomMember<T>> | undefined>;
  count(topic: string, except: string, now: number): Promise<number>;
  lease(playerId: string, owner: string, until: number): Promise<void>;
  release(playerId: string, owner: string): Promise<void>;
  connected(playerId: string, now: number): Promise<boolean>;
}
export type Adapters = { store: Store; bus: Bus; coordination: Coordination; close(): Promise<void> };
