'use client';
import { BadgeCheck, Building2, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { call } from '@/lib/client';
import { useToast } from './toast';

interface SellerSettingsData {
  phone: string | null; phoneVerified: boolean; showPhone: boolean; phoneRequiresVerification?: boolean;
  email?: string; emailVerified?: boolean; showEmail?: boolean | null;
  company: { ico: string | null; name: string | null; address: string | null; vatId: string | null; verifiedAt: string | null; status: 'verified' | 'unverified' | 'invalid' | 'none' } | null;
}

/**
 * Telefon u inzerátů: uložení čísla (bez ověření SMS), viditelnost u inzerátů (výslovný souhlas, výchozí stav vypnuto) a stav ověření firmy v ARES.
 * `refreshKey` = objekt, který se po uložení profilu změní (router.refresh) → údaje se načtou znovu.
 */
export function SellerSettings({ refreshKey }: { refreshKey?: unknown }) {
  const [d, setD] = useState<SellerSettingsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [phoneEdit, setPhoneEdit] = useState(false);
  const [phone, setPhone] = useState('');
  const router = useRouter(); const toast = useToast();
  const load = () => call<SellerSettingsData>('/me/seller-settings').then(setD).catch(() => undefined);
  useEffect(() => { void load(); }, [refreshKey]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast(ok); router.refresh(); } catch (e) { toast((e as Error).message, 'error'); }
    await load();
    setBusy(false);
  }
  if (!d) return null;
  const c = d.company;
  // Ověření SMS se zatím nevyžaduje; když se zapne (PHONE_REQUIRE_VERIFIED), zobrazit jde jen ověřené číslo.
  const canShow = !!d.phone && (!d.phoneRequiresVerification || d.phoneVerified);
  const editing = phoneEdit || !d.phone;

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-bold">Kontakt u inzerátů</h2>
      <p className="mt-1 text-sm text-muted">Kupující vám mohou vždy napsat přes zprávy. Telefon a e-mail uvidí jen přihlášení uživatelé po kliknutí na tlačítko u inzerátu.</p>
      <div className="mt-5 space-y-4">
        <div>
          <label className="label" htmlFor="seller-phone">Telefon</label>
          {editing ? (
            <form className="flex flex-wrap gap-2" onSubmit={(e) => {
              e.preventDefault();
              void act(async () => { await call('/me/phone', 'PUT', { phone }); setPhoneEdit(false); }, 'Telefon uložen');
            }}>
              <input id="seller-phone" className="input min-w-0 flex-1 sm:max-w-64" type="tel" inputMode="tel" autoComplete="tel" placeholder="+420 777 123 456" required maxLength={30}
                value={phone} onChange={(e) => setPhone(e.target.value)} />
              <button className="btn btn-dark h-11" disabled={busy}>Uložit telefon</button>
              {d.phone && <button type="button" onClick={() => setPhoneEdit(false)} className="btn btn-ghost h-11">Zrušit</button>}
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3 text-sm">
              <Phone className="size-4 text-muted" /><span className="flex-1 font-medium">{d.phone}</span>
              {d.phoneVerified && <span className="inline-flex items-center gap-1 font-semibold text-trust"><BadgeCheck className="size-4" />Ověřeno</span>}
              <button type="button" disabled={busy} onClick={() => { setPhone(d.phone ?? ''); setPhoneEdit(true); }} className="btn btn-ghost btn-sm">Změnit</button>
              <button type="button" disabled={busy} onClick={() => { if (confirm('Odebrat telefon z účtu? U inzerátů se přestane zobrazovat.')) void act(() => call('/me/phone', 'DELETE'), 'Telefon odebrán'); }} className="btn btn-ghost btn-sm">Odebrat</button>
            </div>
          )}
          <p className="mt-1.5 text-xs text-muted">České nebo slovenské číslo. Jestli se u inzerátů ukáže, nastavíte níže.</p>
        </div>

        <label className={`flex items-start gap-3 ${canShow ? '' : 'opacity-60'}`}>
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]" checked={d.showPhone && canShow} disabled={!canShow || busy}
            onChange={(e) => { const v = e.target.checked; setD({ ...d, showPhone: v }); void act(() => call('/me/phone-visibility', 'PATCH', { showPhone: v }), v ? 'Telefon se u inzerátů zobrazí' : 'Telefon je skrytý'); }} />
          <span>
            <span className="font-semibold">Zobrazovat telefon u mých inzerátů</span>
            <span className="mt-0.5 block text-sm text-muted">
              {canShow ? 'Číslo uvidí jen přihlášení uživatelé po kliknutí na „Zobrazit telefon“.'
                : d.phone ? 'Nejdřív si v části E-mail a telefon potvrďte číslo SMS kódem. Neověřené číslo nikomu neukážeme.'
                : 'Nejdřív výše uložte telefonní číslo.'}
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]" checked={d.showEmail === true} disabled={busy}
            onChange={(e) => { const v = e.target.checked; setD({ ...d, showEmail: v }); void act(() => call('/me/email-visibility', 'PATCH', { showEmail: v }), v ? 'E-mail se u inzerátů zobrazí' : 'E-mail je skrytý'); }} />
          <span>
            <span className="font-semibold">Zobrazovat e-mail u mých inzerátů</span>
            <span className="mt-0.5 block text-sm text-muted">
              {d.email && <>{d.email}. </>}
              {d.emailVerified === false ? 'Ukáže se, až e-mail potvrdíte odkazem, který jsme vám poslali.' : 'Uvidí ho jen přihlášení po kliknutí na „Zobrazit e-mail“.'}
            </span>
          </span>
        </label>

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
                <p className="flex-1 text-muted">IČO {c.ico} zatím není ověřené v registru ARES (registr možná dočasně neodpovídal). Do ověření se odznak firmy nezobrazí.</p>
                <button type="button" disabled={busy} onClick={() => void act(() => call('/me/company/verify', 'POST'), 'Firma ověřena v ARES')} className="btn btn-outline btn-sm">Ověřit znovu</button>
              </div>
            )}
            {c.status === 'invalid' && <p className="mt-2 text-sm text-danger">IČO {c.ico} u vašeho účtu není platné, a proto ho nejde ověřit. V profilu výše ho opravte, nebo zrušte volbu „Prodávám jako firma / podnikatel“ a profil uložte.</p>}
            {c.status === 'none' && <p className="mt-2 text-sm text-muted">Firemní účet musí mít IČO. Doplňte ho v profilu – ověříme ho v registru ARES a na profilu získáte odznak „Firma s IČO“.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
