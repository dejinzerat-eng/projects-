'use client';
import { useState } from 'react';
import { call } from '@/lib/client';
import { useAct } from './dialog';

interface Settings {
  premoderation: boolean; listingDays: number; freeActiveListings: number; maxListingsPerHour: number; eurRate: number;
  supportEmail: string; supportPhone: string; operatorName: string; operatorIco: string; operatorAddress: string;
}

export function SettingsForm({ initial, canReindex }: { initial: Settings; canReindex: boolean }) {
  const act = useAct();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const num = (k: keyof Settings) => ({ inputMode: 'numeric' as const, value: String(v[k]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: Number(e.target.value.replace(/\D/g, '') || 0) }) });
  const txt = (k: keyof Settings) => ({ value: String(v[k]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) });
  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); act(() => call('/admin/settings', 'PUT', v), 'Nastavení uloženo'); }}>
        <section className="card space-y-4 p-5">
          <h2 className="font-bold">Inzeráty</h2>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-0.5 size-5" checked={v.premoderation} onChange={(e) => setV({ ...v, premoderation: e.target.checked })} />
            <span><span className="font-medium">Premoderace</span><span className="block text-sm text-muted">Každý nový inzerát (i změna textu schváleného) čeká na schválení moderátorem. Bez premoderace jde ke schválení jen rizikový obsah.</span></span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="s-days">Platnost inzerátu (dní)</label><input id="s-days" className="input" {...num('listingDays')} /></div>
            <div><label className="label" htmlFor="s-free">Aktivních inzerátů zdarma</label><input id="s-free" className="input" {...num('freeActiveListings')} /><p className="mt-1 text-xs text-muted">Pro soukromé osoby a neověřené firmy, 0 = bez omezení</p></div>
            <div><label className="label" htmlFor="s-hour">Nových inzerátů za hodinu</label><input id="s-hour" className="input" {...num('maxListingsPerHour')} /><p className="mt-1 text-xs text-muted">Ochrana proti spamu</p></div>
            <div><label className="label" htmlFor="s-eur">Kurz eura (Kč za 1 €)</label><input id="s-eur" className="input" {...num('eurRate')} /><p className="mt-1 text-xs text-muted">Pro řazení a filtr ceny u inzerátů v eurech</p></div>
          </div>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">Kontakt na podporu</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="s-mail">E-mail</label><input id="s-mail" type="email" className="input" {...txt('supportEmail')} /></div>
            <div><label className="label" htmlFor="s-phone">Telefon</label><input id="s-phone" type="tel" className="input" placeholder="+420 …" {...txt('supportPhone')} /></div>
          </div>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">Provozovatel</h2>
          <p className="text-sm text-muted">Zobrazuje se na stránce Kontakt a v právních textech. Prázdná pole = výchozí údaje (ESTI INTERNATIONAL s.r.o.).</p>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div><label className="label" htmlFor="s-op">Název / jméno</label><input id="s-op" className="input" {...txt('operatorName')} /></div>
            <div><label className="label" htmlFor="s-ico">IČO</label><input id="s-ico" inputMode="numeric" maxLength={8} className="input" value={v.operatorIco} onChange={(e) => setV({ ...v, operatorIco: e.target.value.replace(/\D/g, '') })} /></div>
          </div>
          <div><label className="label" htmlFor="s-addr">Sídlo</label><input id="s-addr" className="input" {...txt('operatorAddress')} /></div>
        </section>
        <div className="flex justify-end"><button className="btn btn-dark">Uložit nastavení</button></div>
      </form>
      {canReindex && (
        <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <div className="flex-1"><h2 className="font-bold">Vyhledávání</h2><p className="text-sm text-muted">Znovu zaindexuje všechny inzeráty (např. po hromadné změně kategorií).</p></div>
          <button disabled={busy} onClick={async () => { setBusy(true); await act(() => call('/admin/reindex', 'POST'), 'Vyhledávání přeindexováno'); setBusy(false); }} className="btn btn-outline">{busy ? 'Indexuji…' : 'Přeindexovat vyhledávání'}</button>
        </section>
      )}
    </div>
  );
}
