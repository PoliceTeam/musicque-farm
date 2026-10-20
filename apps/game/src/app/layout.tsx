import type { Metadata, Viewport } from 'next';
import { type ReactNode, Suspense } from 'react';
import { GameApplication } from '@/application/game-application';
import vi from '@/application/i18n/locales/vi/common';

/** Absolute base for share-image URLs; baked at build time like NEXT_PUBLIC_API_URL. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

// Files in public/ are exported by tools/branding/export-icons.py (PNG/ICO: browsers, iOS and crawlers need them).
const share = { url: '/icons/share.png', width: 1200, height: 630, alt: vi.gameShareAlt };

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: vi.gameTitle,
  description: vi.gameDescription,
  applicationName: vi.gameTitle,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: { url: '/icons/apple-touch-icon.png', sizes: '180x180' },
  },
  appleWebApp: { title: vi.gameTitle, capable: true, statusBarStyle: 'default' },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: vi.gameTitle,
    title: vi.gameTitle,
    description: vi.gameDescription,
    images: [share],
  },
  twitter: { card: 'summary_large_image', title: vi.gameTitle, description: vi.gameDescription, images: [share] },
};

export const viewport: Viewport = { themeColor: '#32b0fd' };

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
