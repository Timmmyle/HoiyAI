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
  title: 'Mustring.com - Khảo sát & Bài tập Học tập Thông minh',
  description: 'Nền tảng tạo khảo sát & bài tập trắc nghiệm học tập thông minh tích hợp AI',
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
      { url: '/icon.png', type: 'image/png' }
    ],
    shortcut: '/logo.png',
    apple: '/logo.png'
  }
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
