import Link from 'next/link';
import { Building2, UserRound } from 'lucide-react';

/** Informace o postavení prodávajícího (směrnice Omnibus, § 1820 a 1843 a násl. občanského zákoníku). */
export function SellerStatus({ isBusiness, companyName, companyId }: { isBusiness: boolean; companyName: string | null; companyId?: string | null }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-ink-2">
      {isBusiness ? <Building2 className="mt-0.5 size-5 shrink-0 text-muted" /> : <UserRound className="mt-0.5 size-5 shrink-0 text-muted" />}
      <div>
        {isBusiness ? (
          <>
            <b className="text-ink">Prodávající je podnikatel</b>
            <div className="mt-0.5">{companyName ?? 'Firma'}{companyId && <> · IČO <a className="underline underline-offset-2 hover:text-ink" href={`https://ares.gov.cz/ekonomicke-subjekty?ico=${encodeURIComponent(companyId)}`} target="_blank" rel="noopener noreferrer">{companyId}</a></>}</div>
            <p className="mt-1 text-muted">Při nákupu na dálku máte jako spotřebitel právo odstoupit od smlouvy do 14 dní a reklamovat vady.</p>
          </>
        ) : (
          <>
            <b className="text-ink">Prodávající je soukromá osoba</b>
            <p className="mt-0.5 text-muted">Na nákup se nevztahují práva spotřebitele z distančních smluv (např. odstoupení do 14 dní).</p>
          </>
        )}
        <Link href="/stranka/spotrebitele" className="mt-1 inline-block font-medium text-brand-ink hover:underline">Informace pro spotřebitele</Link>
      </div>
    </div>
  );
}
