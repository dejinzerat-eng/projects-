import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/api';
// formatDetection: mobilní prohlížeče nesmí čísla a adresy ve zprávách samy prolinkovat
export const metadata: Metadata = { title: 'Zprávy', robots: { index: false }, formatDetection: { telephone: false, email: false, address: false } };
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await getMe())) redirect('/prihlaseni?zpet=/zpravy');
  return children;
}
