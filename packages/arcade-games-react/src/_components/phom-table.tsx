import { type PhomResult, type PhomSnapshot, solvePhom } from '@chibi-town/arcade-games/phom-logic';
import { tablePlayerName } from '@chibi-town/arcade-games/table-snapshot';
import type { Outfit } from '@chibi-town/character-core/character-types';
import { defaultOutfit } from '@chibi-town/character-core/outfit-logic';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { roomNumber } from '../_utils/room-number.js';
import { ArcadeAvatar } from './arcade-avatar.js';
import { PlayingCard } from './playing-card.js';
import { TurnCountdown } from './turn-countdown.js';

export function PhomTable({
  match,
  outfit,
  name,
  selected,
  busy,
  event,
  toggle,
  actions,
}: {
  match: PhomSnapshot;
  outfit: Outfit;
  name: string;
  selected: number[];
  busy: boolean;
  event?: PhomResult['steps'][number];
  toggle: (card: number) => void;
  actions?: ReactNode;
}) {
  const { t } = useTranslation('common');
  const count =
    match.status === 'waiting' && match.session?.members
      ? match.session.members.length
      : (match.session?.playerCount ?? 4);

  const seatName = (seat: number) =>
    seat === 0
      ? (tablePlayerName(match.players?.[0]) ?? name)
      : (tablePlayerName(match.players?.[seat]) ?? t(`tienBots.seat-${seat as 1 | 2 | 3}`));

  const meldCards =
    match.status !== 'waiting' && !match.laid[0] ? solvePhom(match.hand, match.eaten[0]).melds.flat() : [];
  return (
    <div
      className={`tien-table-scene phom-table-scene tien-table-scene--${count} ${match.status === 'playing' ? 'has-hand-actions' : ''} ${match.status === 'waiting' ? 'is-waiting' : match.status === 'finished' ? 'is-finished' : ''}`}
    >
      <div className="tien-table-surface" aria-hidden="true" />
      <span className="tien-table-badge">
        {t('arcadeSeatTitle', { room: roomNumber(match.roomId), table: match.tableId + 1 })}
        <small>{t(match.session?.mode === 'practice' ? 'arcadePracticeFree' : 'arcadeWagerGame')}</small>
      </span>
      <div className="tien-table-center phom-center">
        {match.status === 'playing' && (
          <>
            <span className="phom-stock">{t('phomStock', { count: match.stockCount })}</span>
            {match.last && (
              <div className="phom-last">
                <PlayingCard card={match.last.card} />
                <small>{t('phomDiscardedBy', { name: seatName(match.last.seat) })}</small>
              </div>
            )}
            <div className="phom-exposed">
              {match.melds.map((groups, seat) =>
                groups.map((cards) => (
                  <div className="phom-meld" key={cards.join('-')}>
                    <small>{seatName(seat)}</small>
                    <div>
                      {cards.map((card) => (
                        <PlayingCard key={card} card={card} />
                      ))}
                    </div>
                  </div>
                )),
              )}
            </div>
          </>
        )}
        {match.status === 'finished' && (
          <div className="phom-ranking">
            {match.placements?.map((seat, i) => (
              <p key={seat}>
                {t('phomRankResult', {
                  rank: i + 1,
                  name: seatName(seat),
                  result:
                    match.u === seat
                      ? t('phomU')
                      : match.mom?.[seat]
                        ? t('phomMom')
                        : t('phomPoints', { count: match.scores?.[seat] ?? 0 }),
                })}
              </p>
            ))}
          </div>
        )}
      </div>
      <p role="status" className="tien-turn-message">
        {match.status === 'waiting'
          ? t(match.players ? 'tienWaitingPeople' : 'tienWaiting', { count: match.players ? count : count - 1 })
          : match.status === 'finished'
            ? t('phomFinished')
            : busy && event
              ? t(`phomEvents.${event.action}`, { name: seatName(event.actor) })
              : match.turn !== 0
                ? t('tienTurnOf', { name: seatName(match.turn) })
                : t(`phomPhases.${match.phase}`)}
        {match.status === 'playing' && match.turn === 0 && !(busy && event) && (
          <>
            {' · '}
            <TurnCountdown match={match} active />
          </>
        )}
      </p>
      {[0, 1, 2, 3]
        .filter((seat) => seat < count)
        .map((seat) => (
          <section
            key={seat}
            className={`tien-seat tien-seat--${seat} tien-seat--${seat === 0 ? 'self' : count === 2 || (count === 4 && seat === 2) ? 'north' : seat === 1 ? 'east' : 'west'} ${match.status === 'playing' && match.turn === seat ? 'is-turn' : ''}`}
            aria-label={seatName(seat)}
          >
            <strong>{seatName(seat)}</strong>
            <ArcadeAvatar
              outfit={match.players?.[seat]?.outfit ?? (seat === 0 ? outfit : defaultOutfit)}
              mirror={seat === 3}
              label={seatName(seat)}
            />
            <small>
              {match.status === 'waiting'
                ? t(
                    match.players
                      ? match.players[seat]?.id === match.session?.hostId
                        ? 'tienHost'
                        : match.session?.members?.find((m) => m.id === match.players?.[seat]?.id)?.ready
                          ? 'tienReady'
                          : 'arcadeNotReady'
                      : seat === 0
                        ? 'tienHost'
                        : 'tienReady',
                  )
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
            <span key={card} className={meldCards.includes(card) ? 'phom-hand-meld' : ''}>
              <PlayingCard
                card={card}
                selected={selected.includes(card)}
                disabled={
                  busy ||
                  match.turn !== 0 ||
                  match.status !== 'playing' ||
                  match.phase === 'receive' ||
                  match.phase === 'lay'
                }
                onClick={() => toggle(card)}
              />
            </span>
          ))}
        </fieldset>
      )}
      {match.status === 'playing' && <div className="card-hand-actions">{actions}</div>}
    </div>
  );
}
