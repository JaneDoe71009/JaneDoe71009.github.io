import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'IB Info',
  description: 'IB Information',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
