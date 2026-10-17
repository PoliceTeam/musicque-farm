import { createContext, type ReactNode, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { TurnCountdown } from './turn-countdown.js';

const ActionDock = createContext<{
  target: HTMLDivElement | null;
  attach: (target: HTMLDivElement | null) => void;
} | null>(null);

/** Keep controls beside their game logic while rendering them in the shared footer. */
export function ArcadeActionProvider({ children }: { children: ReactNode }) {
  const [target, attach] = useState<HTMLDivElement | null>(null);
  return <ActionDock value={{ target, attach }}>{children}</ActionDock>;
}

export function ArcadeActionTarget() {
  const dock = useContext(ActionDock);
  return <div className="arcade-footer-game-actions" ref={dock?.attach} />;
}

export function ArcadeFooterTimer({
  match,
}: {
  match?: {
    id: string;
    revision: number;
    status: string;
    serverTime?: number;
    turnEndsAt?: number;
    session?: { mode: string };
  };
}) {
  return (
    match && (
      <TurnCountdown
        key={match.session?.mode === 'practice' ? `${match.id}:${match.revision}` : undefined}
        match={match}
        active
        preview={match.session?.mode === 'practice'}
      />
    )
  );
}

export function ArcadeActions({ children }: { children: ReactNode }) {
  const dock = useContext(ActionDock);
  if (!dock) return <>{children}</>;
  return dock.target ? createPortal(children, dock.target) : null;
}
