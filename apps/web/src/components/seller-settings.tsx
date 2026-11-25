'use client';
import { BadgeCheck, Building2, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { call } from '@/lib/client';
import { useToast } from './toast';

interface SellerSettingsData {
  phone: string | null; phoneVerified: boolean; showPhone: boolean;
  company: { ico: string | null; name: string | null; address: string | null; vatId: string | null; verifiedAt: string | null; status: 'verified' | 'unverified' | 'none' } | null;
}

/**
 * Viditelnost telefonu u inzerátů (výslovný souhlas, výchozí stav vypnuto) a stav ověření firmy v ARES.
 * `refreshKey` = objekt, který se po uložení profilu změní (router.refresh) → údaje se načtou znovu.
 */
export function SellerSettings({ refreshKey }: { refreshKey?: unknown }) {
  const [d, setD] = useState<SellerSettingsData | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter(); const toast = useToast();
  const load = () => call<SellerSettingsData>('/me/seller-settings').then(setD).catch(() => undefined);
  useEffect(() => { void load(); }, [refreshKey]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast(ok); await load(); router.refresh(); } catch (e) { toast((e as Error).message, 'error'); }
    setBusy(false);
  }
  if (!d) return null;
  const c = d.company;

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-bold">Kontakt u inzerátů</h2>
      <p className="mt-1 text-sm text-muted">E-mail nikdy nezveřejňujeme. Kupující vám mohou vždy napsat přes zprávy.</p>
      <div className="mt-5 space-y-4">
        <label className={`flex items-start gap-3 ${d.phoneVerified ? '' : 'opacity-60'}`}>
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]" checked={d.showPhone} disabled={!d.phoneVerified || busy}
            onChange={(e) => { const v = e.target.checked; void act(() => call('/me/phone-visibility', 'PATCH', { showPhone: v }), v ? 'Telefon se u inzerátů zobrazí' : 'Telefon je skrytý'); }} />
          <span>
            <span className="font-semibold">Zobrazovat telefon u mých inzerátů</span>
            <span className="mt-0.5 block text-sm text-muted">
              {d.phoneVerified ? 'Číslo uvidí jen přihlášení uživatelé po kliknutí na „Zobrazit telefon“.' : 'Nejdřív si v části Ověření potvrďte telefon SMS kódem. Neověřené číslo nikomu neukážeme.'}
            </span>
          </span>
        </label>
        {d.phoneVerified && d.phone && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-3 text-sm">
            <Phone className="size-4 text-muted" /><span className="flex-1">{d.phone}</span>
            <button type="button" disabled={busy} onClick={() => { if (confirm('Odebrat telefon z účtu? Přijdete i o odznak ověřeného telefonu.')) void act(() => call('/me/phone', 'DELETE'), 'Telefon odebrán'); }} className="btn btn-ghost btn-sm">Odebrat telefon</button>
          </div>
        )}

        {c && (
          <div className="border-t border-line pt-4">
            <h3 className="flex items-center gap-2 font-semibold"><Building2 className="size-4 text-muted" />Firemní účet</h3>
            {c.status === 'verified' && (
              <div className="mt-2 text-sm">
                <p className="inline-flex items-center gap-1 font-semibold text-trust"><BadgeCheck className="size-4" />Ověřeno v registru ARES</p>
                <p className="mt-1">{c.name} · IČO {c.ico}{c.vatId ? ` · DIČ ${c.vatId}` : ''}</p>
                {c.address && <p className="text-muted">{c.address}</p>}
                <p className="mt-1 text-xs text-muted">Obchodní jméno a sídlo přebíráme z ARES. Na profilu máte odznak „Firma s IČO“.</p>
              </div>
            )}
            {c.status === 'unverified' && (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <p className="flex-1 text-muted">IČO {c.ico} zatím není ověřené – registr ARES při uložení neodpověděl. Do ověření se odznak firmy nezobrazí.</p>
                <button type="button" disabled={busy} onClick={() => void act(() => call('/me/company/verify', 'POST'), 'Firma ověřena v ARES')} className="btn btn-outline btn-sm">Ověřit znovu</button>
              </div>
            )}
            {c.status === 'none' && <p className="mt-2 text-sm text-muted">Doplňte v profilu IČO. Ověříme ho v registru ARES a na profilu získáte odznak „Firma s IČO“.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
