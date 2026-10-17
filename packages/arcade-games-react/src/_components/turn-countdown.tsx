import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { turnSeconds } from '../_utils/table-updates.js';

type TimedTable = {
  status: string;
  serverTime?: number;
  turnEndsAt?: number;
};

/** Use the server clock sampled on receipt, just like the farm clock. */
export function TurnCountdown({
  match,
  active,
  prominent = false,
  preview = false,
}: {
  match: TimedTable;
  active: boolean;
  prominent?: boolean;
  /** Local visual preview only. Reaching zero never sends a game command. */
  preview?: boolean;
}) {
  const { t } = useTranslation('common');
  const base = useMemo(() => {
    const real = Date.now();
    return preview
      ? { server: real, real, deadline: real + 60_000 }
      : { server: match.serverTime, real, deadline: match.turnEndsAt };
  }, [preview, match.serverTime, match.turnEndsAt]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active || match.status !== 'playing' || base.deadline === undefined) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [active, match.status, base.deadline]);
  if (!active || match.status !== 'playing' || base.deadline === undefined || base.server === undefined) return null;
  const seconds = turnSeconds(base.deadline, base.server, base.real, now);
  const warning = seconds <= 10;
  return (
    <strong
      role="timer"
      className={`arcade-turn-countdown ${warning ? 'is-warning' : ''}`}
      style={{ color: warning ? '#e04938' : undefined, fontSize: prominent ? '1.25em' : undefined }}
    >
      {t(
        preview
          ? seconds === 0
            ? 'arcadePracticeTimeUp'
            : 'arcadePracticeCountdown'
          : warning
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
