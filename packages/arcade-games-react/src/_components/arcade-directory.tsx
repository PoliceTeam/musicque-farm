import type { ArcadeSession } from '@chibi-town/arcade-games/session';
import type { ArcadeRoom } from '@chibi-town/contracts/arcade';
import { ARCADE_PRACTICE_ROOM_ID } from '@chibi-town/game-content/arcade-catalog';
import { useTranslation } from 'react-i18next';
import { roomNumber } from '../_utils/room-number.js';
import { useArcadeHost } from '../host.js';

export function ArcadeDirectory({
  gameName,
  gameId,
  rooms,
  roomId,
  active,
  busy,
  selectRoom,
  join,
  leaveLegacy,
}: {
  gameName: string;
  gameId: string;
  rooms: readonly ArcadeRoom[];
  roomId?: number;
  active?: { roomId: number; tableId?: number; session?: ArcadeSession };
  busy: boolean;
  selectRoom: (roomId: number) => void;
  join: (roomId: number, tableId: number) => void;
  leaveLegacy?: () => void;
}) {
  const { t } = useTranslation('common');
  const { account } = useArcadeHost();
  const restricted = !!account?.guest && gameId !== 'bau-cua' && gameId !== 'slots';
  const room = rooms.find((entry) => entry.id === roomId);
  const legacy = !!active && !active.session;
  return (
    <section className="arcade-rooms">
      <h2 className="arcade-ribbon">
        {room
          ? room.id === ARCADE_PRACTICE_ROOM_ID
            ? t('arcadePracticeRoom')
            : t('arcadeBeginnerRoomNumber', { id: roomNumber(room.id) })
          : t('arcadeGameRooms', { game: gameName })}
      </h2>
      {room && room.id !== ARCADE_PRACTICE_ROOM_ID && restricted && (
        <p className="arcade-guest-access">{t('arcadeGuestRestriction')}</p>
      )}
      {active && (
        <p className="arcade-resume">
          {t('arcadeActiveSeat', { room: roomNumber(active.roomId), table: (active.tableId ?? 0) + 1 })}
          {!room && (
            <button className="ui-button" type="button" disabled={busy} onClick={() => selectRoom(active.roomId)}>
              {t('arcadeGoActiveRoom')}
            </button>
          )}
        </p>
      )}
      {legacy && (
        <div className="arcade-table-settings arcade-legacy-notice">
          <p>{t('arcadeLegacyDirectoryInfo')}</p>
          {leaveLegacy && (
            <button className="ui-button" type="button" disabled={busy} onClick={leaveLegacy}>
              {t('arcadeLeaveLegacy')}
            </button>
          )}
        </div>
      )}
      {!room ? (
        <div className="arcade-room-groups">
          {(['practice', 'beginner'] as const).map((kind) => {
            const groupRooms = rooms.filter(
              (entry) => (entry.id === ARCADE_PRACTICE_ROOM_ID) === (kind === 'practice'),
            );
            if (!groupRooms.length) return null;
            return (
              <section
                className="arcade-room-group"
                key={kind}
                aria-label={t(kind === 'practice' ? 'arcadePracticeRoom' : 'arcadeBeginnerRoom')}
              >
                <h3 className="arcade-room-group-title">
                  {t(kind === 'practice' ? 'arcadePracticeRoom' : 'arcadeBeginnerRoom')}
                </h3>
                {kind === 'beginner' && restricted && (
                  <div className="arcade-guest-access">
                    <p>{t('arcadeGuestRestriction')}</p>
                    <button className="ui-button" type="button" onClick={() => account?.request()}>
                      {t('arcadeGuestAction')}
                    </button>
                  </div>
                )}
                <div className="arcade-room-list">
                  {groupRooms.map((entry) => {
                    const occupied = entry.tables.filter((table) => table.occupants > 0).length;
                    const filled = Math.ceil((occupied / Math.max(1, entry.tables.length)) * 3);
                    return (
                      <button
                        className="arcade-room"
                        type="button"
                        key={entry.id}
                        disabled={busy}
                        onClick={() => {
                          if (restricted && kind === 'beginner') account?.request();
                          else selectRoom(entry.id);
                        }}
                        aria-label={t('arcadeRoomChoice', {
                          kind: t(kind === 'practice' ? 'arcadePracticeRoom' : 'arcadeBeginnerRoom'),
                          room: roomNumber(entry.id),
                          tables: entry.tables.length,
                          occupied,
                        })}
                      >
                        <span className="arcade-room-number">{roomNumber(entry.id)}</span>
                        <span className="arcade-room-title">
                          <span>{t('arcadeRoomTables', { count: entry.tables.length })}</span>
                          <small>
                            {t(
                              kind === 'practice'
                                ? 'arcadePracticeFree'
                                : restricted
                                  ? 'arcadeGuestLocked'
                                  : 'arcadeWagerGame',
                            )}
                          </small>
                        </span>
                        <span
                          className="arcade-room-capacity"
                          role="img"
                          aria-label={t('arcadeRoomOccupancy', { occupied, total: entry.tables.length })}
                        >
                          {[0, 1, 2].map((bar) => (
                            <i key={bar} className={bar < filled ? 'filled' : ''} aria-hidden="true" />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="arcade-table-grid">
          {room.tables.map((table) => {
            const continuing = active?.roomId === room.id && (active.tableId ?? 0) === table.id;
            return (
              <button
                key={table.id}
                className={`arcade-table-card ${continuing ? 'is-active' : ''}`}
                type="button"
                disabled={busy || (!!active && !continuing)}
                onClick={() => {
                  if (restricted && room.id !== ARCADE_PRACTICE_ROOM_ID) account?.request();
                  else join(room.id, table.id);
                }}
                aria-label={t('arcadeTableLabel', {
                  table: table.id + 1,
                  occupied: table.occupants,
                  capacity: table.capacity,
                })}
              >
                <strong className="arcade-table-number" aria-hidden="true">
                  {table.id + 1}
                </strong>
                <svg className="arcade-table-drawing" viewBox="0 0 180 100" aria-hidden="true" focusable="false">
                  <ellipse cx="90" cy="54" rx="40" ry="23" />
                  {[0, 1, 2, 3].slice(0, table.capacity).map((seat) => {
                    const x = seat % 2 === 0 ? 28 : 152;
                    const y = table.capacity === 4 ? (seat < 2 ? 25 : 70) : 47;
                    return (
                      <g
                        key={seat}
                        className={seat < table.occupants ? 'is-occupied' : 'is-empty'}
                        transform={`translate(${x} ${y})`}
                      >
                        <circle cy="-13" r="9" />
                        <path d="M-16 14 Q-16 -4 0 -4 Q16 -4 16 14 Z" />
                      </g>
                    );
                  })}
                </svg>
                <span className="arcade-table-status">
                  {t(
                    continuing
                      ? 'arcadeResume'
                      : table.status === 'empty'
                        ? 'arcadeTableEmpty'
                        : table.status === 'waiting'
                          ? 'arcadeTableOpen'
                          : 'arcadeTablePlaying',
                  )}
                </span>
                <small>
                  {table.occupants}/{table.capacity}
                </small>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
