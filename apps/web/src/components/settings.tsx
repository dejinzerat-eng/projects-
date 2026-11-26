'use client';
import { BadgeCheck, Camera, Download, Laptop, Mail, Phone, Smartphone, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { CITIES, isValidIco } from '@dej/shared';
import type { Me } from '@/lib/api';
import { call } from '@/lib/client';
import { ago } from '@/lib/format';
import { shrinkImage } from '@/lib/image';
import { Avatar } from './avatar';
import { SellerSettings } from './seller-settings';
import { useToast } from './toast';

export interface SessionItem { id: string; device: string; ip: string | null; createdAt: string; lastUsedAt: string; current: boolean }
type Account = Me & { hasGoogle?: boolean; hasApple?: boolean };

function Section({ id, title, desc, children }: { id?: string; title: string; desc?: string; children: React.ReactNode }) {
  return <section id={id} className="card scroll-mt-24 p-5 sm:p-6"><h2 className="text-lg font-bold">{title}</h2>{desc && <p className="mt-1 text-sm text-muted">{desc}</p>}<div className="mt-5">{children}</div></section>;
}
const Verified = () => <span className="inline-flex items-center gap-1 text-sm font-semibold text-trust"><BadgeCheck className="size-4" />Ověřeno</span>;

export function Settings({ me, blocked, sessions, smsEnabled, welcome }: { me: Account; blocked: { id: string; name: string }[]; sessions: SessionItem[]; smsEnabled: boolean; welcome?: boolean }) {
  const router = useRouter(); const toast = useToast();
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); router.refresh(); return true; } catch (e) { toast((e as Error).message, 'error'); return false; } };
  const [p, setP] = useState({ name: me.name, bio: me.bio ?? '', city: me.city ?? '', isBusiness: me.isBusiness, companyName: me.companyName ?? '', companyId: me.companyId ?? '' });

  const icoBad = p.isBusiness && p.companyId.length === 8 && !isValidIco(p.companyId);

  // telefon
  const [phoneEdit, setPhoneEdit] = useState(!me.phoneVerifiedAt);
  const [phone, setPhone] = useState(me.phone ?? '');
  const [codeSent, setCodeSent] = useState<string | null>(null);
  const [code, setCode] = useState('');
  // e-mail
  const [emailEdit, setEmailEdit] = useState(false);
  const [newEmail, setNewEmail] = useState({ email: '', password: '' });
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  // heslo, fotka, smazání účtu
  const [pw, setPw] = useState({ current: '', password: '' });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [del, setDel] = useState<{ open: boolean; password: string }>({ open: false, password: '' });

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', await shrinkImage(file, 1024, 0.88));
      await call('/auth/avatar', 'POST', fd);
      toast('Fotka uložena'); router.refresh();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function sendCode() {
    try { const r = await call<{ devCode?: string }>('/auth/phone/send', 'POST', { phone }); setCodeSent(r.devCode ?? ''); setCode(''); toast('Poslali jsme vám SMS s kódem'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <div className="space-y-5">
      <h1 className="h-display text-3xl font-bold">Nastavení účtu</h1>
      {welcome && <div className="rounded-2xl bg-trust-soft p-4 text-trust">Vítejte na Dejinzerat.cz! Poslali jsme vám e-mail k ověření adresy. Ověřte si také telefon – získáte odznak <b>Ověřený prodejce</b>.</div>}

      <Section id="profil" title="Profil" desc="Jméno, fotka a lokalita se zobrazují u vašich inzerátů.">
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={me.name} url={me.avatarUrl} size={72} />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" aria-label="Vybrat profilovou fotku" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-outline btn-sm" disabled={uploading}><Camera className="size-4" />{uploading ? 'Nahrávám…' : me.avatarUrl ? 'Změnit fotku' : 'Nahrát fotku'}</button>
            {me.avatarUrl && <button type="button" onClick={() => run(() => call('/auth/avatar', 'DELETE'), 'Fotka odstraněna')} className="btn btn-ghost btn-sm">Odstranit</button>}
          </div>
        </div>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => call('/me', 'PATCH', { ...p, companyId: p.companyId || '' }), 'Profil uložen'); }}>
          <div><label className="label" htmlFor="n">Jméno</label><input id="n" className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
          <div><label className="label" htmlFor="c">Lokalita</label><input id="c" list="cities2" className="input" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} /><datalist id="cities2">{CITIES.map((c) => <option key={c.name} value={c.name} />)}</datalist></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="b">O mně</label><textarea id="b" className="input" rows={3} maxLength={600} value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} /></div>
          <label className="flex items-center gap-3 sm:col-span-2"><input type="checkbox" className="size-5 accent-[var(--brand)]" checked={p.isBusiness} onChange={(e) => setP({ ...p, isBusiness: e.target.checked })} />Prodávám jako firma / podnikatel</label>
          {p.isBusiness && <>
            <div><label className="label" htmlFor="cn">Název firmy</label><input id="cn" className="input" value={p.companyName} onChange={(e) => setP({ ...p, companyName: e.target.value })} /></div>
            <div><label className="label" htmlFor="ci">IČO</label><input id="ci" className="input" inputMode="numeric" required pattern="\d{8}" title="IČO má 8 číslic." maxLength={8} aria-invalid={icoBad || undefined} aria-describedby={icoBad ? 'ci-err' : undefined} value={p.companyId} onChange={(e) => setP({ ...p, companyId: e.target.value.replace(/\D/g, '') })} /></div>
            {icoBad
              ? <p id="ci-err" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger sm:col-span-2">IČO {p.companyId} není platné – nesedí kontrolní číslice. Opravte ho podle výpisu v <a href="https://ares.gov.cz/ekonomicke-subjekty" target="_blank" rel="noopener noreferrer" className="font-semibold underline">registru ARES</a>, nebo zrušte volbu „Prodávám jako firma / podnikatel“ a profil uložte.</p>
              : <p className="-mt-2 text-xs text-muted sm:col-span-2">Firemní účet musí mít IČO. Ověříme ho v registru ARES a obchodní jméno a sídlo doplníme odtud.</p>}
          </>}
          <div className="sm:col-span-2"><button className="btn btn-dark">Uložit profil</button></div>
        </form>
      </Section>
      <SellerSettings refreshKey={me} />

      <Section id="overeni" title="E-mail a telefon" desc="Ověření prodejci mají u inzerátů zelený odznak a kupující jim víc důvěřují.">
        <div className="divide-y divide-line">
          <div className="pb-4">
            <div className="flex items-center gap-3">
              <Mail className="size-5 shrink-0 text-muted" /><span className="min-w-0 flex-1 break-all">{me.email}</span>
              {me.emailVerifiedAt ? <Verified /> : <span className="text-sm font-semibold text-muted">Neověřeno</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 pl-8">
              {!me.emailVerifiedAt && <button onClick={() => run(() => call('/auth/resend-verification', 'POST'), 'Ověřovací e-mail odeslán')} className="btn btn-outline btn-sm">Poslat ověřovací e-mail</button>}
              {!emailEdit && <button onClick={() => { setEmailEdit(true); setEmailSentTo(null); }} className={`btn btn-ghost btn-sm ${me.emailVerifiedAt ? "-ml-3" : ""}`}>Změnit e-mail</button>}
            </div>
            {emailSentTo && <p className="mt-3 rounded-xl bg-trust-soft p-3 text-sm text-trust">Na adresu <b>{emailSentTo}</b> jsme poslali odkaz. Změna proběhne, až ho otevřete (platí 24 hodin).</p>}
            {emailEdit && (
              <form className="mt-4 grid gap-3 rounded-xl bg-surface-2 p-4 sm:grid-cols-2" onSubmit={async (e) => {
                e.preventDefault();
                try { const r = await call<{ email: string }>('/auth/email/change', 'POST', { email: newEmail.email, ...(me.hasPassword ? { password: newEmail.password } : {}) }); setEmailSentTo(r.email); setEmailEdit(false); setNewEmail({ email: '', password: '' }); }
                catch (err) { toast((err as Error).message, 'error'); }
              }}>
                <div><label className="label" htmlFor="ne">Nový e-mail</label><input id="ne" type="email" autoComplete="email" required className="input" value={newEmail.email} onChange={(e) => setNewEmail({ ...newEmail, email: e.target.value })} /></div>
                {me.hasPassword && <div><label className="label" htmlFor="nep">Současné heslo</label><input id="nep" type="password" autoComplete="current-password" required className="input" value={newEmail.password} onChange={(e) => setNewEmail({ ...newEmail, password: e.target.value })} /></div>}
                <div className="flex flex-wrap gap-2 sm:col-span-2"><button className="btn btn-dark btn-sm">Poslat potvrzovací odkaz</button><button type="button" onClick={() => setEmailEdit(false)} className="btn btn-ghost btn-sm">Zrušit</button></div>
              </form>
            )}
          </div>

          <div className="pt-4">
            <div className="flex items-center gap-3">
              <Phone className="size-5 shrink-0 text-muted" />
              {me.phoneVerifiedAt && !phoneEdit ? <>
                <span className="min-w-0 flex-1">{me.phone}</span><Verified />
              </> : <span className="min-w-0 flex-1 text-sm text-muted">{smsEnabled ? 'Telefon ověříte kódem z SMS.' : 'Ověření telefonu brzy spustíme.'}</span>}
            </div>
            {me.phoneVerifiedAt && !phoneEdit && smsEnabled && <div className="mt-2 pl-8"><button onClick={() => { setPhoneEdit(true); setPhone(''); }} className="btn btn-ghost btn-sm -ml-3">Změnit číslo</button></div>}
            {phoneEdit && smsEnabled && (
              <form className="mt-3 flex flex-wrap gap-2 pl-8" onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
                <input className="input min-w-0 flex-1 sm:max-w-56" type="tel" inputMode="tel" autoComplete="tel" placeholder="+420 777 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Telefon" required />
                <button className="btn btn-outline h-11">Poslat kód</button>
                {me.phoneVerifiedAt && <button type="button" onClick={() => { setPhoneEdit(false); setCodeSent(null); }} className="btn btn-ghost h-11">Zrušit</button>}
              </form>
            )}
            {codeSent !== null && phoneEdit && smsEnabled && (
              <form className="mt-3 ml-8 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3" onSubmit={async (e) => {
                e.preventDefault();
                if (await run(() => call('/auth/phone/verify', 'POST', { code }), 'Telefon ověřen')) { setCodeSent(null); setPhoneEdit(false); }
              }}>
                <input className="input max-w-40 tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Kód z SMS" />
                <button className="btn btn-dark h-11" disabled={code.length !== 6}>Ověřit</button>
                {codeSent && <span className="text-xs text-muted">Testovací režim: kód {codeSent}</span>}
              </form>
            )}
          </div>
        </div>
      </Section>

      <Section id="heslo" title={me.hasPassword ? 'Změna hesla' : 'Nastavit heslo'} desc={me.hasPassword ? 'Po změně hesla odhlásíme ostatní zařízení.' : `Přihlašujete se přes ${me.hasApple && !me.hasGoogle ? 'Apple' : 'Google'}. Heslo si můžete nastavit i pro přihlášení e-mailem.`}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); if (await run(() => call('/auth/password/change', 'POST', pw), me.hasPassword ? 'Heslo změněno' : 'Heslo nastaveno')) setPw({ current: '', password: '' }); }}>
          {me.hasPassword && <div><label className="label" htmlFor="cp">Současné heslo</label><input id="cp" type="password" autoComplete="current-password" required className="input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>}
          <div><label className="label" htmlFor="np">Nové heslo</label><input id="np" type="password" autoComplete="new-password" minLength={8} required className="input" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></div>
          <div className="sm:col-span-2"><button className="btn btn-dark">Uložit heslo</button></div>
        </form>
      </Section>

      <Section id="zarizeni" title="Přihlášená zařízení" desc="Pokud nějaké zařízení nepoznáváte, odhlaste ho a změňte si heslo.">
        <ul className="divide-y divide-line">
          {sessions.map((s) => {
            const Icon = /iPhone|Android|iPad/.test(s.device) ? Smartphone : Laptop;
            return (
              <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0">
                <Icon className="size-5 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">{s.device}{s.current && <span className="badge bg-brand-soft text-brand-ink">Toto zařízení</span>}</p>
                  <p className="text-sm text-muted">{s.current ? 'Používáte teď' : `Naposledy ${ago(s.lastUsedAt)}`}{s.ip ? ` · IP ${s.ip}` : ''}</p>
                </div>
                <button onClick={async () => {
                  try { const r = await call<{ current: boolean }>(`/auth/sessions/${s.id}`, 'DELETE'); if (r.current) { location.href = '/prihlaseni'; return; } toast('Zařízení odhlášeno'); router.refresh(); }
                  catch (e) { toast((e as Error).message, 'error'); }
                }} className="btn btn-outline btn-sm">Odhlásit</button>
              </li>
            );
          })}
          {!sessions.length && <li className="py-3 text-sm text-muted">Žádná aktivní přihlášení.</li>}
        </ul>
        {sessions.length > 1 && (
          <button onClick={async () => { if (await run(() => call('/auth/sessions/revoke-all', 'POST'), 'Odhlášeno ze všech zařízení')) location.href = '/prihlaseni'; }} className="btn btn-ghost mt-3">Odhlásit ze všech zařízení</button>
        )}
      </Section>

      {blocked.length > 0 && (
        <Section title="Zablokovaní uživatelé">
          <ul className="divide-y divide-line">{blocked.map((b) => <li key={b.id} className="flex items-center justify-between py-2.5"><span>{b.name}</span><button onClick={() => run(() => call(`/users/${b.id}/unblock`, 'POST'), 'Odblokováno')} className="btn btn-outline btn-sm">Odblokovat</button></li>)}</ul>
        </Section>
      )}

      <Section id="gdpr" title="Osobní údaje (GDPR)" desc="Kdykoli si můžete stáhnout všechna svá data nebo účet smazat.">
        <div className="flex flex-wrap gap-2">
          <a href="/api/me/export" download="dejinzerat-moje-data.json" className="btn btn-outline"><Download className="size-4" />Stáhnout moje data</a>
          {!del.open && <button onClick={() => setDel({ open: true, password: '' })} className="btn btn-danger"><Trash2 className="size-4" />Smazat účet</button>}
        </div>
        {del.open && (
          <form className="mt-4 space-y-3 rounded-xl border border-danger/30 bg-danger-soft p-4" onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => call('/me', 'DELETE', me.hasPassword ? { password: del.password } : {}), 'Účet smazán')) location.href = '/';
          }}>
            <p className="text-sm font-medium text-danger">Smazáním účtu odstraníme všechny vaše inzeráty a osobní údaje. Akci nelze vrátit.</p>
            {me.hasPassword && <div><label className="label" htmlFor="dp">Pro potvrzení zadejte heslo</label><input id="dp" type="password" autoComplete="current-password" required className="input max-w-sm" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} /></div>}
            <div className="flex flex-wrap gap-2"><button className="btn bg-danger text-white hover:brightness-95">Trvale smazat účet</button><button type="button" onClick={() => setDel({ open: false, password: '' })} className="btn btn-ghost">Zrušit</button></div>
          </form>
        )}
      </Section>
    </div>
  );
}
