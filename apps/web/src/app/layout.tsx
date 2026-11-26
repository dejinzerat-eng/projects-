import type { Metadata, Viewport } from 'next';
import { Onest } from 'next/font/google';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { MobileNav } from '@/components/mobile-nav';
import { TermsBanner } from '@/components/terms-banner';
import { ToastProvider } from '@/components/toast';
import { getMe } from '@/lib/api';
import { HOME_TITLE, SITE, SITE_DESCRIPTION, SITE_NAME, social } from '@/lib/seo';
import './globals.css';

const body = Onest({ subsets: ['latin', 'latin-ext'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: HOME_TITLE, template: '%s | Dejinzerat.cz' },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  ...social({ title: HOME_TITLE, description: SITE_DESCRIPTION }),
  formatDetection: { telephone: false },
  robots: process.env.NOINDEX === '1' ? { index: false, follow: false } : undefined,
};
export const viewport: Viewport = { themeColor: '#f6f7f8' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  return (
    <html lang="cs" className={body.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('dej_theme')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}" }} /></head>
      <body className="min-h-dvh font-sans antialiased">
        <ToastProvider>
          <a href="#obsah" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">Přeskočit na obsah</a>
          <Header me={me} />
          {me?.termsOutdated && <TermsBanner />}
          <main id="obsah">{children}</main>
          <Footer />
          <MobileNav unread={me ? { messages: me.unreadMessages, notifications: me.unreadNotifications } : undefined} loggedIn={!!me} />
        </ToastProvider>
      </body>
    </html>
  );
}
