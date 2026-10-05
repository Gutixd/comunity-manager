import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import { WORKSHOP } from '@/lib/content';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '800'], variable: '--font-display' });
const body = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-body' });

export const metadata: Metadata = {
  title: `${WORKSHOP.tag} · ${WORKSHOP.title}`,
  description: WORKSHOP.subtitle,
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: '#14051f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
