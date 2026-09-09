import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'IB Info | Student hub',
  description: 'An independent student hub for IB subjects, dates, resources, and community.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
