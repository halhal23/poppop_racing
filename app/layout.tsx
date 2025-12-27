import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'PopPop Racing',
  description: 'Two-player auto racing MVP',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="app-shell">
        {children}
      </body>
    </html>
  );
}
