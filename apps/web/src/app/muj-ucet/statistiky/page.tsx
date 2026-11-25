import Link from 'next/link';
import { Eye, Heart, MessageCircle, Phone } from 'lucide-react';
import { api } from '@/lib/api';
import { listingUrl, plural, price, STATUS_LABEL } from '@/lib/format';

export const metadata = { title: 'Statistiky', robots: { index: false } };

interface Stats {
  days: number; from: string; to: string;
  totals: { listings: number; active: number; views: number; favorites: number; conversations: number };
  period: { views: number; phoneReveals: number; favorites: number; conversations: number };
  daily: { date: string; views: number; phoneReveals: number; favorites: number; conversations: number }[];
  listings: { id: string; slug: string; title: string; status: string; image: string | null; price: number | null; priceNegotiable: boolean; currency: string; views: number; favorites: number; conversations: number; periodViews: number; periodPhoneReveals: number; periodFavorites: number; periodConversations: number }[];
  trackingSince: string | null;
}

const PERIODS = [[7, '7 dní'], [30, '30 dní'], [90, '90 dní']] as const;
const n = (x: number) => new Intl.NumberFormat('cs-CZ').format(x);
const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  const dny = (await searchParams).dny;
  const s = await api<Stats>(`/me/stats?dny=${typeof dny === 'string' ? encodeURIComponent(dny) : '30'}`);
  const max = Math.max(1, ...s.daily.map((d) => d.views));
  const tiles = [
    ['Zobrazení inzerátů', s.period.views, Eye, `celkem ${n(s.totals.views)}`],
    ['Zobrazení telefonu', s.period.phoneReveals, Phone, 'kolikrát si někdo zobrazil vaše číslo'],
    ['Uložení do oblíbených', s.period.favorites, Heart, `celkem ${n(s.totals.favorites)}`],
    ['Noví zájemci ve zprávách', s.period.conversations, MessageCircle, `celkem ${n(s.totals.conversations)}`],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-display text-3xl font-bold">Statistiky</h1>
          <p className="mt-1 text-muted">Jak si vedou vaše inzeráty za posledních {plural(s.days, 'den', 'dny', 'dní')} ({shortDate(s.from)} – {shortDate(s.to)}).</p>
        </div>
        <nav aria-label="Období" className="flex gap-1.5">
          {PERIODS.map(([v, l]) => <Link key={v} href={`/muj-ucet/statistiky?dny=${v}`} aria-current={s.days === v ? 'page' : undefined} className={`chip ${s.days === v ? 'chip-active' : ''}`}>{l}</Link>)}
        </nav>
      </div>

      {s.totals.listings === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <p className="text-muted">Statistiky uvidíte, jakmile vložíte první inzerát.</p>
          <Link href="/pridat" className="btn btn-primary">Vložit první inzerát</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map(([label, value, Icon, sub]) => (
              <div key={label} className="card p-4">
                <div className="flex items-center gap-1.5 text-sm text-muted"><Icon className="size-4" />{label}</div>
                <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{n(value)}</div>
                <div className="text-xs text-muted">{sub}</div>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <h2 className="font-bold">Zobrazení po dnech</h2>
            <div className="mt-4 flex h-40 items-end gap-[2px] sm:gap-1" role="img" aria-label={`Graf zobrazení po dnech, celkem ${n(s.period.views)}, nejvíc ${n(max)} za den`}>
              {s.daily.map((d) => (
                <div key={d.date} className="flex-1 rounded-t bg-brand/80 hover:bg-brand" style={{ height: `${(d.views / max) * 100}%`, minHeight: 2 }}
                  title={`${shortDate(d.date)}: ${plural(d.views, 'zobrazení', 'zobrazení', 'zobrazení')}, ${plural(d.favorites, 'uložení', 'uložení', 'uložení')}, ${plural(d.conversations, 'nový zájemce', 'noví zájemci', 'nových zájemců')}`} />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted"><span>{shortDate(s.from)}</span><span>{shortDate(s.to)}</span></div>
          </div>

          <div className="card overflow-hidden">
            <h2 className="px-5 pt-5 font-bold">Podle inzerátů</h2>
            <p className="px-5 text-sm text-muted">Čísla za zvolené období, šedě celkem za celou dobu inzerátu.</p>
            <ul className="mt-3 divide-y divide-line">
              {s.listings.map((l) => (
                <li key={l.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Link href={listingUrl(l)} className="shrink-0" tabIndex={-1} aria-hidden>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {l.image ? <img src={l.image} alt="" className="h-12 w-16 rounded-lg object-cover" /> : <div className="h-12 w-16 rounded-lg bg-surface-2" />}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={listingUrl(l)} className="block truncate font-semibold hover:underline">{l.title}</Link>
                      <div className="text-sm text-muted">
                        {price(l.price, l.priceNegotiable, l.currency)}
                        {l.status !== 'ACTIVE' && <> · {STATUS_LABEL[l.status] ?? l.status}</>}
                      </div>
                    </div>
                  </div>
                  <dl className="grid shrink-0 grid-cols-[repeat(4,auto)] justify-between gap-x-3 text-sm sm:grid-cols-[7.5rem_3.5rem_4.5rem_4.5rem] sm:justify-normal sm:gap-x-4">
                    <Metric icon={Eye} label="Zobrazení" value={l.periodViews} total={l.views} />
                    <Metric icon={Phone} label="Zobrazení telefonu" value={l.periodPhoneReveals} />
                    <Metric icon={Heart} label="Uložení" value={l.periodFavorites} total={l.favorites} />
                    <Metric icon={MessageCircle} label="Zájemci" value={l.periodConversations} total={l.conversations} />
                  </dl>
                </li>
              ))}
            </ul>
          </div>

          {s.trackingSince && <p className="text-xs text-muted">Denní statistiky zobrazení evidujeme od {new Date(`${s.trackingSince}T00:00:00Z`).toLocaleDateString('cs-CZ', { timeZone: 'UTC' })}. Starší zobrazení jsou započítaná jen v celkovém součtu. Vlastní návštěvy se nepočítají.</p>}
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, total }: { icon: typeof Eye; label: string; value: number; total?: number }) {
  return (
    <div className="flex items-center gap-1.5 tabular-nums" title={label}>
      <dt className="text-muted"><Icon className="size-4" aria-hidden /><span className="sr-only">{label}</span></dt>
      <dd className="whitespace-nowrap font-semibold">{n(value)}{total != null && <span className="ml-1 font-normal text-muted">/ {n(total)}</span>}</dd>
    </div>
  );
}
