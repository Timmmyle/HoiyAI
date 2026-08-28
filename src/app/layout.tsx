import type { Metadata } from 'next';
import { Noto_Sans_Mono } from 'next/font/google';
import './globals.css';

const notoSansMono = Noto_Sans_Mono({
  subsets: ['vietnamese', 'latin'],
  variable: '--font-noto-sans-mono',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Website Survey AI',
  description: 'Nền tảng khảo sát thông minh tích hợp AI - Thay thế Google Forms',
};

import { ToastProvider } from '@/context/ToastContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${notoSansMono.variable}`}>
      <body className="font-mono bg-background text-textMain min-h-screen flex flex-col">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
