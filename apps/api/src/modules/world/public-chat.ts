import type { ChatArea, ChatMessage, ChatScope } from '@chibi-town/contracts/public-chat';
import type { RealtimeCommand } from '@chibi-town/contracts/realtime';
import { CHAT_HISTORY_LIMIT, CHAT_HISTORY_TTL, CHAT_SEND_INTERVAL } from '@chibi-town/game-content/public-chat';
import type { Connection, Coordination, RealtimeService } from '@chibi-town/realtime-core';
import type { PlayerAccount } from '@/_utils/session-auth';

const topicFor = (scope: ChatScope) => `chat:${scope.regionId}:${scope.mapId}:${scope.channelId}`;

type Receipt = { id: string; topic: string; text: string; message: ChatMessage };
type SenderState = { at: number; receipts: Receipt[] };

/** Public chat has independent subscriptions; watching a farm/interior never replaces a movement room. */
export function registerPublicChat(
  realtime: RealtimeService,
  deps: {
    clock(): number;
    coordination: Coordination;
    resolveScope(player: PlayerAccount, area: ChatArea): Promise<ChatScope | undefined>;
  },
) {
  const watched = new Map<string, ChatScope>();
  const { clock, coordination } = deps;

  async function leave(connection: Connection) {
    const scope = watched.get(connection.id);
    watched.delete(connection.id);
    if (scope) await realtime.unsubscribe(connection, topicFor(scope));
  }

  realtime.handle<Extract<RealtimeCommand, { type: 'chat.watch' }>>(
    'chat.watch',
    async (connection, command) => {
      const scope = await deps.resolveScope(connection.identity.context as PlayerAccount, command);
      if (!scope) return;
      const previous = watched.get(connection.id);
      if (previous && topicFor(previous) !== topicFor(scope)) await leave(connection);
      await realtime.subscribe(connection, topicFor(scope));
      watched.set(connection.id, scope);
      await coordination.exclusive(`${topicFor(scope)}:append`, async () => {
        const messages = (await coordination.get<ChatMessage[]>(topicFor(scope))) ?? [];
        realtime.send(connection, { type: 'chat.state', scope, messages });
      });
    },
    { expensive: true },
  );
  realtime.handle('chat.leave', leave);
  realtime.handle<Extract<RealtimeCommand, { type: 'chat.send' }>>('chat.send', async (connection, command) => {
    const scope = watched.get(connection.id);

    const fail = (error: 'NOT_READY' | 'TOO_FAST' | 'CONFLICT') =>
      realtime.send(connection, { type: 'chat.result', requestId: command.requestId, messageId: null, error });

    if (!scope) return fail('NOT_READY');
    const player = connection.identity.context as PlayerAccount;
    const topic = topicFor(scope);
    const id = `${connection.identity.playerId}:${command.requestId}`;
    await coordination.exclusive(`chat-sender:${player.id}`, async () => {
      const key = `chat-sender:${player.id}:state`;
      const state = await coordination.get<SenderState>(key);
      const prior = state?.receipts.find((receipt) => receipt.id === id);
      if (prior) {
        if (prior.topic !== topic || prior.text !== command.text) return fail('CONFLICT');
        realtime.send(connection, { type: 'chat.result', requestId: command.requestId, messageId: id, error: null });
        return;
      }
      const now = clock();
      if (state && now - state.at < CHAT_SEND_INTERVAL) return fail('TOO_FAST');
      await coordination.exclusive(`${topic}:append`, async () => {
        const history = (await coordination.get<ChatMessage[]>(topic)) ?? [];
        const existing = history.find((message) => message.id === id);
        if (existing && existing.text !== command.text) return fail('CONFLICT');
        const message: ChatMessage = existing ?? {
          id,
          playerId: player.id,
          name: player.name,
          level: player.level,
          text: command.text,
          sentAt: now,
        };
        if (!existing)
          await coordination.set(topic, [...history, message].slice(-CHAT_HISTORY_LIMIT), CHAT_HISTORY_TTL);
        await coordination.set(
          key,
          {
            at: now,
            receipts: [...(state?.receipts ?? []), { id, topic, text: command.text, message }].slice(-100),
          } satisfies SenderState,
          CHAT_HISTORY_TTL,
        );
        await realtime.publish(topic, { type: 'chat.message', scope, message });
        realtime.send(connection, { type: 'chat.result', requestId: command.requestId, messageId: id, error: null });
      });
    });
  });
  realtime.onDisconnect(leave);
  realtime.onShutdown(() => watched.clear());
}
