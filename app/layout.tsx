import type { Metadata, Viewport } from 'next';
import { Source_Sans_3 } from 'next/font/google';
import './globals.css';
import { PwaRegister } from '@/components/PwaRegister';

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '800'],
  variable: '--font-source-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Direct Message (dm) - LinkedIn Outreach Assistant',
  description: 'Upload your LinkedIn connections CSV and generate tailored DMs for job hunting, agency leads, hiring, or freelancing in seconds.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Direct Message'
  }
};

export const viewport: Viewport = {
  themeColor: '#0A66C2',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sourceSans.variable}>
      <head>
        <link rel="icon" href="/icon-192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body className="bg-[#F4F2EE] text-zinc-900 antialiased font-sans selection:bg-[#0A66C2]/20 selection:text-[#0A66C2] min-h-screen">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
