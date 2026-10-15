import type { ReactNode } from 'react';

export function GameHeader({ profile, title, children }: { profile: ReactNode; title: string; children?: ReactNode }) {
  return (
    <header className="ui-game-header">
      {profile}
      <h1 className="ui-header-title">{title}</h1>
      <aside className="ui-header-counters ui-wallet" aria-label="Tài nguyên">
        {children}
      </aside>
    </header>
  );
}
