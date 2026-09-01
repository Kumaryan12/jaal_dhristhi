import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
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
  metadataBase: new URL('https://jaal-drishti.nitgoa2023.chatgpt.site'),
  title: 'JaalDrishti | Ecosystem Risk Intelligence',
  description:
    'Explainable network and temporal risk intelligence for lending operations.',
  openGraph: {
    title: 'TVS JaalDrishti',
    description: 'Detect the network before it becomes the loss.',
    images: [{ url: '/og.png', width: 1736, height: 906 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TVS JaalDrishti',
    description: 'Detect the network before it becomes the loss.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
