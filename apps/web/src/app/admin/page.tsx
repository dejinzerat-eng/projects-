import Link from 'next/link';
import { api } from '@/lib/api';
import { price, STATUS_LABEL } from '@/lib/format';
import { access, NoAccess } from './_access';

interface Stats {
  users: number; users7: number; users30: number; dau: number; wau: number; mau: number;
  listings: number; active: number; pending: number; byStatus: Record<string, number>; listings24: number; listings7: number; listings30: number;
  reports: number; reportTargets: number; messages7: number; businessesActive: number; businessesTotal: number; businessesVerified: number; restricted: number; revenue30: number;
  byCategory: { name: string; count: number }[]; daily: { date: string; listings: number; users: number }[]; searchEngine: string;
}

const n = (v: number) => new Intl.NumberFormat('cs-CZ').format(v);
const STATUS_ORDER = ['ACTIVE', 'PENDING', 'RESERVED', 'SOLD', 'EXPIRED', 'REJECTED', 'DRAFT'];

export default async function Page() {
  const { ok } = await access('stats.read');
  if (!ok) return <NoAccess />;
  const s = await api<Stats>('/admin/stats');
  const max = Math.max(1, ...s.daily.map((d) => Math.max(d.listings, d.users)));
  const catMax = Math.max(1, ...s.byCategory.map((c) => c.count));
  const tiles: { label: string; value: string; sub: string; href?: string; alert?: boolean }[] = [
    { label: 'Aktivní uživatelé', value: n(s.mau), sub: `za 30 dní · ${n(s.dau)} dnes · ${n(s.wau)} za 7 dní` },
    { label: 'Uživatelé celkem', value: n(s.users), sub: `${n(s.users7)} registrací za 7 dní · ${n(s.users30)} za 30 dní` },
    { label: 'Všechny inzeráty', value: n(s.listings), sub: `${n(s.active)} aktivních` },
    { label: 'Nové inzeráty', value: n(s.listings7), sub: `${n(s.listings24)} za 24 h · ${n(s.listings30)} za 30 dní` },
    { label: 'Ke schválení', value: n(s.pending), sub: 'inzerátů čeká', href: '/admin/inzeraty?status=PENDING', alert: s.pending > 0 },
    { label: 'Nahlášení', value: n(s.reports), sub: `otevřených · ${n(s.reportTargets)} různých cílů`, href: '/admin/nahlaseni', alert: s.reports > 0 },
    { label: 'Aktivní firmy', value: n(s.businessesActive), sub: `s aktivním inzerátem · ${n(s.businessesTotal)} celkem, ${n(s.businessesVerified)} ověřených` },
    { label: 'Omezené účty', value: n(s.restricted), sub: 'čekají na kontrolu', href: '/admin/uzivatele?stav=RESTRICTED', alert: s.restricted > 0 },
    { label: 'Zprávy', value: n(s.messages7), sub: 'za 7 dní' },
    { label: 'Tržby (30 dní)', value: price(s.revenue30), sub: 'platby ve fázi 2' },
  ];
  return (
    <div className="space-y-6">
      <h1 className="h-display text-3xl font-bold">Přehled</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((t) => {
          const body = <><div className="text-sm text-muted">{t.label}</div><div className={`mt-1 text-3xl font-bold tracking-tight ${t.alert ? 'text-danger' : ''}`}>{t.value}</div><div className="text-xs text-muted">{t.sub}</div></>;
          return t.href ? <Link key={t.label} href={t.href} className="card block p-4 hover:shadow-pop">{body}</Link> : <div key={t.label} className="card p-4">{body}</div>;
        })}
      </div>
      <div className="card p-5">
        <h2 className="font-bold">Inzeráty podle stavu</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {STATUS_ORDER.map((st) => <li key={st}><Link href={`/admin/inzeraty?status=${st}`} className="chip"><span>{STATUS_LABEL[st]}</span><span className="font-bold tabular-nums">{n(s.byStatus[st] ?? 0)}</span></Link></li>)}
        </ul>
      </div>
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Nové inzeráty a registrace za 30 dní</h2>
          <div className="flex gap-3 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand" />inzeráty</span><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-trust" />registrace</span></div>
        </div>
        <div className="mt-4 flex h-40 items-end gap-0.5 sm:gap-1" role="img" aria-label="Graf nových inzerátů a registrací po dnech">
          {s.daily.map((d) => (
            <div key={d.date} className="flex h-full flex-1 items-end gap-px" title={`${d.date}: ${d.listings} inzerátů, ${d.users} registrací`}>
              <div className="flex-1 rounded-t bg-brand/80" style={{ height: `${(d.listings / max) * 100}%`, minHeight: 2 }} />
              <div className="flex-1 rounded-t bg-trust/70" style={{ height: `${(d.users / max) * 100}%`, minHeight: d.users ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted"><span>{s.daily[0]?.date}</span><span>{s.daily.at(-1)?.date}</span></div>
      </div>
      <div className="card p-5">
        <h2 className="mb-4 font-bold">Aktivní inzeráty podle kategorií</h2>
        <ul className="space-y-2">{s.byCategory.map((c) => <li key={c.name} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 text-sm sm:grid-cols-[160px_1fr_40px]"><span className="truncate">{c.name}</span><span className="h-2.5 rounded-full bg-surface-2"><span className="block h-full rounded-full bg-ink" style={{ width: `${(c.count / catMax) * 100}%` }} /></span><span className="text-right tabular-nums">{c.count}</span></li>)}</ul>
      </div>
      <p className="text-xs text-muted">Aktivní uživatel = přihlášený uživatel, který web použil v daném období. Vyhledávání: {s.searchEngine}. Návštěvnost se bude měřit přes Google Analytics 4 / Plausible po nasazení na doménu.</p>
    </div>
  );
}
