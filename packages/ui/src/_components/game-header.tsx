import type { ReactNode } from 'react';

export function GameHeader({ profile, title, children }: { profile: ReactNode; title: string; children?: ReactNode }) {
  return (
    <header className="ui-game-header">
      {profile}
      <h1 className="farm-title">{title}</h1>
      <aside className="farm-capacity ui-wallet" aria-label="Tài nguyên">
        {children}
      </aside>
    </header>
  );
}
