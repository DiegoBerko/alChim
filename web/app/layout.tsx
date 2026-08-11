import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'alChim Backoffice',
  description: 'Personal trainer backoffice',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-bg text-white antialiased">{children}</body>
    </html>
  );
}
