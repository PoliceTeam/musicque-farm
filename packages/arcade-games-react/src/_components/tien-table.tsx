import { tablePlayerName } from '@chibi-town/arcade-games/table-snapshot';
import type { TienResult, TienSnapshot } from '@chibi-town/arcade-games/tien-len-logic';
import type { Outfit } from '@chibi-town/character-core/character-types';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { roomNumber } from '../_utils/room-number.js';
import { ArcadeAvatar } from './arcade-avatar.js';
import { CardTableSurface } from './card-table-surface.js';
import { PlayingCard } from './playing-card.js';
import { TurnCountdown } from './turn-countdown.js';

const SEATS = [0, 1, 2, 3] as const;

export function TienTable({
  match,
  outfit,
  name,
  selected,
  busy,
  event,
  toggle,
  actions,
}: {
  match: TienSnapshot;
  outfit: Outfit;
  name: string;
  selected: number[];
  busy: boolean;
  event?: TienResult['steps'][number];
  toggle: (card: number) => void;
  actions?: ReactNode;
}) {
  const { t } = useTranslation('common');

  /** At a table of people the server sends the names in seat order; otherwise the other seats are bots. */
  const seatName = (seat: number) =>
    seat === 0
      ? (tablePlayerName(match.players?.[0]) ?? name)
      : (tablePlayerName(match.players?.[seat]) ?? t(`tienBots.seat-${seat as 1 | 2 | 3}`));

  const memberOf = (seat: number) => match.session?.members?.find((member) => member.id === match.players?.[seat]?.id);

  const playerCount =
    match.status === 'waiting' && match.session?.members
      ? match.session.members.length
      : (match.session?.playerCount ?? 4);
  return (
    <div
      className={`tien-table-scene tien-table-scene--${playerCount} ${match.status === 'playing' ? 'has-hand-actions' : ''} ${match.status === 'waiting' ? 'is-waiting' : ''}`}
    >
      <CardTableSurface />
      <span className="tien-table-badge">
        {t('arcadeSeatTitle', { room: roomNumber(match.roomId), table: (match.tableId ?? 0) + 1 })}
        <small>
          {t(
            match.session?.mode === 'practice'
              ? 'arcadePracticeFree'
              : match.session?.mode === 'wager'
                ? 'arcadeWagerGame'
                : 'arcadeFreeBattle',
          )}
        </small>
      </span>
      <div className="tien-table-center">
        {match.pile && (
          <div className="tien-pile">
            {match.pile.cards.map((card) => (
              <PlayingCard key={card} card={card} />
            ))}
          </div>
        )}
      </div>
      <p role="status" className="tien-turn-message">
        {match.status === 'waiting'
          ? match.players
            ? t('tienWaitingPeople', { count: playerCount })
            : t('tienWaiting', { count: playerCount - 1 })
          : match.status === 'finished'
            ? match.placements?.length === 2
              ? t('tienTopTwo', {
                  first: seatName(match.placements[0]),
                  second: seatName(match.placements[1]),
                })
              : t('tienWinner', { name: seatName(match.winner ?? 0) })
            : busy && event
              ? t('tienEvent', {
                  name: seatName(event.actor),
                  action: t(`tienActions.${event.action}`),
                })
              : match.turn === 0
                ? t('tienYourTurn')
                : t('tienTurnOf', { name: seatName(match.turn) })}
        {match.status === 'playing' && match.turn === 0 && !(busy && event) && (
          <>
            {' · '}
            <TurnCountdown match={match} active />
          </>
        )}
      </p>
      {SEATS.filter((seat) => seat < playerCount).map((seat) => (
        <section
          key={seat}
          className={`tien-seat tien-seat--${seat} tien-seat--${seat === 0 ? 'self' : playerCount === 2 || (playerCount === 4 && seat === 2) ? 'north' : seat === 1 ? 'east' : 'west'} ${match.status === 'playing' && match.turn === seat ? 'is-turn' : ''} ${match.passed.includes(seat) ? 'has-passed' : ''}`}
          aria-label={seatName(seat)}
        >
          <strong>{seatName(seat)}</strong>
          <ArcadeAvatar
            outfit={match.players?.[seat]?.outfit ?? (seat === 0 ? outfit : defaultOutfit)}
            mirror={seat === 3}
            label={seatName(seat)}
          />
          <small hidden={match.status === 'waiting' && match.session?.mode === 'practice'}>
            {match.status === 'waiting'
              ? t(
                  match.players
                    ? memberOf(seat)?.id === match.session?.hostId
                      ? 'tienHost'
                      : memberOf(seat)?.ready
                        ? 'tienReady'
                        : 'arcadeNotReady'
                    : seat === 0
                      ? 'tienHost'
                      : 'tienReady',
                )
              : match.placements?.includes(seat)
                ? t('tienPlacement', { rank: match.placements.indexOf(seat) + 1 })
                : match.passed.includes(seat)
                  ? t('tienPassed')
                  : t('tienCardCount', { count: match.counts[seat] })}
            {seat !== 0 && match.turn === seat && (
              <>
                {' · '}
                <TurnCountdown match={match} active />
              </>
            )}
          </small>
        </section>
      ))}
      {match.hand.length > 0 && (
        <fieldset className="tien-hand" aria-label={t('tienYourHand')}>
          {match.hand.map((card) => (
            <PlayingCard
              key={card}
              card={card}
              selected={selected.includes(card)}
              disabled={busy || match.status !== 'playing'}
              onClick={() => toggle(card)}
            />
          ))}
        </fieldset>
      )}
      {actions}
    </div>
  );
}
