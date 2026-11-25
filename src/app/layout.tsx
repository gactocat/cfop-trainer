import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AppDialogs } from '@/components/AppDialogs';
import { HtmlLang } from '@/components/HtmlLang';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { AccountBoundary, AccountSession } from '@/components/AccountBoundary';
import { ColorTheme } from '@/components/ColorTheme';
import { HeaderTitle } from '@/components/HeaderTitle';
import { PublicLinks } from '@/components/PublicLinks';
import { DISPLAY_INIT_SCRIPT } from '@/lib/display-init-script';
import { HEADER_ACTIONS_ID, HEADER_TOOLBAR_ID } from '@/lib/header-slots';
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
    'Manage CFOP F2L, OLL and PLL algorithms, record solve times, and train recognition with random cases.',
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
  viewportFit: 'cover',
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
      // The head script sets lang, data-theme and the pending language flag
      // before hydration, so these attributes differ from the server's.
      suppressHydrationWarning
    >
      <head>
        {/* Before the first paint: theme and language from this device (see display-init-script.ts). */}
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <AccountSession />
        <ServiceWorkerRegister />
        <HtmlLang />
        <ColorTheme />
        <header className="pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
          {/* Back and the page's title, then what the page adds: a list page's Select and random practice, and its selection tools below. */}
          <div className="mx-auto max-w-6xl px-3 sm:px-4 py-3 flex min-h-[3.75rem] items-center gap-2">
            <HeaderTitle />
            <div id={HEADER_ACTIONS_ID} className="flex flex-1 items-center gap-2" />
          </div>
          <div id={HEADER_TOOLBAR_ID} />
        </header>
        <main className="mx-auto w-full max-w-6xl pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex-1">
          <AccountBoundary>{children}</AccountBoundary>
        </main>
        <AppDialogs />
        <footer className="mx-auto w-full max-w-6xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"><PublicLinks /></footer>
      </body>
    </html>
  );
}
