import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { turnSeconds } from '../_utils/table-updates.js';

type TimedTable = { status: string; serverTime?: number; turnEndsAt?: number };

/** Use the server clock sampled on receipt, just like the farm clock. */
export function TurnCountdown({
  match,
  active,
  prominent = false,
}: {
  match: TimedTable;
  active: boolean;
  prominent?: boolean;
}) {
  const { t } = useTranslation('common');
  const base = useMemo(() => ({ server: match.serverTime, real: Date.now() }), [match.serverTime]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active || match.status !== 'playing' || match.turnEndsAt === undefined) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [active, match.status, match.turnEndsAt]);
  if (!active || match.status !== 'playing' || match.turnEndsAt === undefined || base.server === undefined) return null;
  const seconds = turnSeconds(match.turnEndsAt, base.server, base.real, now);
  const warning = seconds <= 10;
  return (
    <strong
      role="timer"
      className={`arcade-turn-countdown ${warning ? 'is-warning' : ''}`}
      style={{ color: warning ? '#e04938' : undefined, fontSize: prominent ? '1.25em' : undefined }}
    >
      {t(
        warning
          ? prominent
            ? 'arcadeYourTurnWarning'
            : 'arcadeTurnWarning'
          : prominent
            ? 'arcadeYourTurnCountdown'
            : 'arcadeTurnCountdown',
        { seconds },
      )}
    </strong>
  );
}
