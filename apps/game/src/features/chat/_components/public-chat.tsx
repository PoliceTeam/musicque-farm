import { type ChatArea, type ChatMessage, type ChatScope, normalizeChatText } from '@chibi-town/contracts/public-chat';
import { CHAT_MAX_LENGTH, publicChatArea } from '@chibi-town/game-content/public-chat';
import { hasOpenGameDialog } from '@chibi-town/ui';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getRealtime } from '@/application/api-sdk';
import { publicChatCss } from '@/assets/generated-styles';
import { mergeChatMessages, opensPublicChat, sameChatScope } from '@/features/chat/_utils/chat-area';

export function PublicChat({ area, playerId }: { area: ChatArea; playerId?: string }) {
  const { t } = useTranslation('chat');
  const { regionId, mapId } = area;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scope, setScope] = useState<ChatScope>();
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const atBottom = useRef(true);
  const joined = useRef(false);
  const composing = useRef(false);
  const currentScope = useRef<ChatScope | undefined>(undefined);
  const observedChannel = useRef<number | undefined>(undefined);
  const pending = useRef<{ requestId: string; text: string } | undefined>(undefined);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const realtime = useRef<ReturnType<typeof getRealtime>>(undefined);

  function close() {
    setOpen(false);
    previousFocus.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const interactive = !!target?.closest(
        'input, textarea, select, button, a, [role="textbox"], [contenteditable]:not([contenteditable="false"])',
      );
      if (!opensPublicChat(event, interactive, hasOpenGameDialog())) return;
      event.preventDefault();
      event.stopPropagation();
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
      requestAnimationFrame(() => input.current?.focus());
    };

    window.addEventListener('keydown', keydown, true);
    return () => window.removeEventListener('keydown', keydown, true);
  }, []);
  useEffect(() => {
    if (open) {
      input.current?.focus();
      atBottom.current = true;
    }
  }, [open]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: New messages and opening the log require scrolling after commit.
  useEffect(() => {
    if (atBottom.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, open]);
  useEffect(() => {
    const client = getRealtime();
    realtime.current = client;
    if (!client) return;
    const stop = client.subscribe((event) => {
      if (event.type === 'disconnected' || event.type === 'reconnected') {
        joined.current = false;
        setReady(false);
        return;
      }
      if (event.type === 'map.state' && event.mapId === mapId) {
        observedChannel.current = event.channelId;
        if (currentScope.current && currentScope.current.channelId !== event.channelId) {
          currentScope.current = undefined;
          joined.current = false;
          setReady(false);
          setMessages([]);
          client.send({ type: 'chat.watch', regionId, mapId });
        }
      }
      if (event.type === 'chat.state' && event.scope.mapId === mapId && event.scope.regionId === regionId) {
        if (observedChannel.current !== undefined && event.scope.channelId !== observedChannel.current) return;
        const previous = currentScope.current;
        currentScope.current = event.scope;
        setScope(event.scope);
        joined.current = true;
        setReady(true);
        setMessages((value) =>
          mergeChatMessages(previous && sameChatScope(previous, event.scope) ? value : [], event.messages),
        );
      }
      if (event.type === 'chat.message' && currentScope.current && sameChatScope(currentScope.current, event.scope)) {
        setMessages((value) => mergeChatMessages(value, [event.message]));
        if (pending.current && event.message.id === `${playerId}:${pending.current.requestId}`) {
          clearTimeout(timeout.current);
          pending.current = undefined;
          setSending(false);
          setDraft('');
          setError('');
        }
      }
      if (event.type === 'chat.result' && event.requestId === pending.current?.requestId) {
        clearTimeout(timeout.current);
        pending.current = undefined;
        setSending(false);
        if (!event.error) {
          setDraft('');
          setError('');
        } else
          setError(t(event.error === 'TOO_FAST' ? 'tooFast' : event.error === 'NOT_READY' ? 'notReady' : 'conflict'));
      }
    });
    client.send({ type: 'chat.watch', regionId, mapId });
    const handshake = setInterval(() => {
      if (!joined.current) client.send({ type: 'chat.watch', regionId, mapId });
    }, 5000);
    return () => {
      clearInterval(handshake);
      clearTimeout(timeout.current);
      stop();
      client.send({ type: 'chat.leave' });
    };
  }, [mapId, regionId, playerId, t]);

  function send() {
    if (composing.current || !joined.current || !ready || sending || !realtime.current) return;
    const text = normalizeChatText(draft);
    if (!text || [...text].length > CHAT_MAX_LENGTH) return;
    pending.current ??= { requestId: crypto.randomUUID(), text };
    setSending(true);
    setError('');
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      setSending(false);
      setError(t('timeout'));
    }, 8000);
    try {
      realtime.current.send({ type: 'chat.send', ...pending.current });
    } catch {
      clearTimeout(timeout.current);
      setSending(false);
      setError(t('timeout'));
    }
  }

  const label = publicChatArea(regionId, mapId)?.label ?? '';
  return (
    <aside className={`game-ui public-chat${open ? ' is-open' : ''}`} aria-label={t('title')}>
      <style>{publicChatCss}</style>
      <button
        type="button"
        className="public-chat-toggle"
        aria-expanded={open}
        onClick={() => {
          previousFocus.current = document.activeElement as HTMLElement;
          if (open) close();
          else setOpen(true);
        }}
      >
        {t('title')} <span>{scope ? t('area', { name: label, channel: scope.channelId }) : label}</span>
        <kbd>Space</kbd>
      </button>
      {(open || messages.length > 0) && (
        <div
          className="public-chat-log"
          role="log"
          aria-live="polite"
          aria-label={t('messages')}
          ref={log}
          onScroll={() => {
            if (log.current)
              atBottom.current = log.current.scrollHeight - log.current.scrollTop - log.current.clientHeight < 30;
          }}
        >
          {(open ? messages : messages.slice(-4)).map((message) => (
            <p key={message.id}>
              <strong>{message.name}</strong>
              <span>{message.text}</span>
            </p>
          ))}
          {open && messages.length === 0 && <p className="public-chat-empty">{t('empty')}</p>}
        </div>
      )}
      {open && (
        <form
          className="public-chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <label className="public-chat-label" htmlFor="public-chat-input">
            {t('input')}
          </label>
          <input
            id="public-chat-input"
            ref={input}
            value={draft}
            maxLength={CHAT_MAX_LENGTH * 2}
            readOnly={!!pending.current}
            autoComplete="off"
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            placeholder={t('placeholder')}
            onChange={(event) => setDraft([...event.target.value].slice(0, CHAT_MAX_LENGTH).join(''))}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Escape') {
                event.preventDefault();
                close();
              }
              if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
                event.preventDefault();
                if (!event.repeat) send();
              }
            }}
          />
          <button type="submit" disabled={!ready || sending || !normalizeChatText(draft)}>
            {t(sending ? 'sending' : pending.current ? 'retry' : 'send')}
          </button>
          {!ready && <small role="status">{t(realtime.current ? 'connecting' : 'offline')}</small>}
          {error && <small role="alert">{error}</small>}
          <small className="public-chat-shortcut">
            {t('shortcut')}{' '}
            <span>
              {[...draft].length}/{CHAT_MAX_LENGTH}
            </span>
          </small>
        </form>
      )}
    </aside>
  );
}
