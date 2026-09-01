import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://jaal-drishti.nitgoa2023.chatgpt.site'),
  title: 'JaalDrishti | Ecosystem Risk Intelligence',
  description:
    'Explainable network and temporal risk intelligence for lending operations.',
  icons: { icon: '/favicon.svg' },
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
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
