import type { Metadata, Viewport } from 'next';
import '@/app/globals.css';
import { geistMono, geistSans } from '@/app/fonts';
import { AppProviders } from '@/app/providers';

export const metadata: Metadata = {
  title: 'Research Framework',
  description: 'Breadth-first domain research with conversational deep-dives.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
