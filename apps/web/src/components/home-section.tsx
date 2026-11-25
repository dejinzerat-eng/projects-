import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/** Sekce hlavní stránky: nadpis, volitelný podtitulek a odkaz „Zobrazit vše“. */
export function HomeSection({ id, title, subtitle, href, children }: { id: string; title: string; subtitle?: React.ReactNode; href?: string; children: React.ReactNode }) {
  return (
    <section className="container-x pt-12 sm:pt-16" aria-labelledby={id}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id={id} className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        </div>
        {href && <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted hover:text-ink">Zobrazit vše<ArrowRight className="size-4" /></Link>}
      </div>
      {children}
    </section>
  );
}

/** Zástupné karty při načítání mřížky. */
export function GridSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={`overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface ${i >= 2 ? 'hidden md:block' : ''}`}>
          <div className="aspect-[4/3] animate-pulse bg-surface-2" />
          <div className="space-y-2 p-3"><div className="h-4 w-1/2 rounded bg-surface-2" /><div className="h-3 w-4/5 rounded bg-surface-2" /></div>
        </div>
      ))}
    </div>
  );
}
