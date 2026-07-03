import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import NavBar from '../components/NavBar';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GadgetHub — Secure Electronics Store',
  description: 'A secure e-commerce store — security assignment demo',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {/* Keyboard users can jump straight past the nav to the content. */}
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <NavBar />
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
