import {
  decodeRealtimeEvent,
  type GameRealtime,
  type RealtimeCommand,
  type RealtimeEvent,
} from '@chibi-town/contracts/realtime';

type Socket = Pick<WebSocket, 'send' | 'close' | 'readyState'> & {
  onopen: ((event: never) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: never) => void) | null;
};
const OPEN = 1;

/**
 * One socket to `apps/api`, reopened with backoff. The server forgets a connection's map room and lobby watch
 * when it drops, so the latest of each is sent again after every reconnect.
 */
export function createRealtimeClient(options: {
  url: string;
  open?: (url: string) => Socket;
  retryMs?: number;
  schedule?: (task: () => void, ms: number) => unknown;
}): GameRealtime {
  const open = options.open ?? ((url) => new WebSocket(url) as unknown as Socket);
  const schedule = options.schedule ?? ((task, ms) => setTimeout(task, ms));
  const listeners = new Set<(event: RealtimeEvent) => void>();
  let socket: Socket | undefined;
  let closed = false;
  let attempts = 0;
  let room: RealtimeCommand | undefined;
  let lobby: RealtimeCommand | undefined;

  function connect() {
    if (closed) return;
    const next = open(options.url);
    socket = next;
    next.onopen = () => {
      attempts = 0;
      for (const command of [room, lobby]) if (command) next.send(JSON.stringify(command));
    };
    next.onmessage = (message) => {
      let event: RealtimeEvent | undefined;
      try {
        event = decodeRealtimeEvent(JSON.parse(String(message.data)));
      } catch {}
      if (event) for (const listener of [...listeners]) listener(event);
    };
    next.onclose = () => {
      if (socket !== next || closed) return;
      socket = undefined;
      schedule(connect, Math.min(30_000, (options.retryMs ?? 1000) * 2 ** attempts++));
    };
  }

  connect();
  return {
    send(command) {
      if (command.type === 'map.enter') room = command;
      else if (command.type === 'map.leave') room = undefined;
      else if (command.type === 'map.move' && room?.type === 'map.enter')
        room = { ...room, x: command.x, y: command.y };
      else if (command.type === 'lobby.watch') lobby = command;
      else if (command.type === 'lobby.unwatch') lobby = undefined;
      if (socket?.readyState === OPEN) socket.send(JSON.stringify(command));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    close() {
      closed = true;
      socket?.close();
      listeners.clear();
    },
  };
}
