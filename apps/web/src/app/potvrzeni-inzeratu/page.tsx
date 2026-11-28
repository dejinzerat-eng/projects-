import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GuestListingConfirm } from '@/components/guest-confirm';
import { AuthShell } from '@/components/auth-shell';

export const metadata: Metadata = { title: 'Zveřejnění inzerátu', robots: { index: false } };

/** Odkaz z e-mailu po vložení inzerátu bez registrace (viz docs/VKLADANI-BEZ-REGISTRACE.md). */
export default function Page() {
  return <AuthShell title="Zveřejnění inzerátu"><Suspense><GuestListingConfirm /></Suspense></AuthShell>;
}
