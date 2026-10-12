import type { Metadata, Viewport } from 'next';
import { Archivo, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'fatcap.club', template: '%s / fatcap.club' },
  icons: { icon: '/favicon.svg' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#0E0E0D', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Same dot color as the landing page: random on first visit, then kept.
const dotScript = `try{var D=['#FF5FA2','#FF5A1F','#3D6BFF','#CFCFCF'],d=localStorage.getItem('fatcap-dot');if(D.indexOf(d)<0){d=D[Math.random()*D.length|0];localStorage.setItem('fatcap-dot',d)}document.documentElement.style.setProperty('--dot',d)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: dotScript }} />
      </head>
      <body>
        <div className="bg" aria-hidden="true" />
        {children}
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}
