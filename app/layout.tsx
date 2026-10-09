import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegister } from '@/components/PwaRegister';

export const metadata: Metadata = {
  title: 'Direct Message - LinkedIn Outreach Assistant',
  description: 'Upload your LinkedIn connections CSV and generate tailored DMs for job hunting, agency leads, hiring, or freelancing in seconds.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Direct Message'
  }
};

export const viewport: Viewport = {
  themeColor: '#f7f7f8',
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
    <html lang="en">
      <head>
        <link rel="icon" href="/icon-192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body className="bg-[#f7f7f8] text-zinc-900 antialiased selection:bg-zinc-200">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
