import { type ReactNode, Suspense } from 'react';
import { GameApplication } from '@/application/game-application';
import vi from '@/application/i18n/locales/vi/common';
export const metadata = { title: vi.gameTitle, description: vi.gameDescription };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0 }}>
        <Suspense fallback={<p role="status">{vi.loadingGame}</p>}>
          <GameApplication />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
