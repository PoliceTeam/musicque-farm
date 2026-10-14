import { type ReactNode, Suspense } from 'react';
import { GameApplication } from '@/application/game-application';
export const metadata = { title: 'Chibi Town', description: 'Thế giới nông trại Chibi Town' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0 }}>
        <Suspense fallback={<p role="status">Đang tải game…</p>}>
          <GameApplication />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
