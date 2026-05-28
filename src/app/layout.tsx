import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import { PracticeTabs } from '@/components/PracticeTabs';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CFOP Trainer',
  description:
    'Manage CFOP F2L and PLL algorithms, record solve times, and train recognition with random cases.',
  applicationName: 'CFOP Trainer',
  appleWebApp: {
    capable: true,
    title: 'CFOP Trainer',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  // Block accidental pinch-zoom in the trainer surfaces; UI is already
  // mobile-sized.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <ServiceWorkerRegister />
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
            <Link href="/" className="font-semibold text-lg tracking-tight">
              CFOP Trainer
            </Link>
            <PracticeTabs />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
