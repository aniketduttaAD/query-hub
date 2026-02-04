import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';

if (typeof window === 'undefined') {
  import('../lib/scheduler').catch((error) => {
    import('../lib/logger').then(({ logger }) => {
      logger.error('Failed to initialize cleanup scheduler', error);
    });
  });
}

export const metadata: Metadata = {
  title: 'QueryHub',
  applicationName: 'QueryHub',
  description: 'QueryHub is a modern playground for SQL and MongoDB.',
  icons: {
    icon: [
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
