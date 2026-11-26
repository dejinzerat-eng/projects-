import { notFound, permanentRedirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

export const metadata = { robots: { index: false } };

/** Stará adresa inzerátu z www.dejinzerat.cz (/produkt?id=…) → nový inzerát. */
export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  const raw = (await searchParams).id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !/^([0-9a-f-]{36}|\d{1,12})$/i.test(id)) notFound();
  let l: { id: string; slug: string } | null = null;
  try { l = await api<{ id: string; slug: string }>(`/legacy/listing/${id.toLowerCase()}`, { auth: false }); } catch (e) { if (!(e instanceof ApiError)) throw e; }
  if (!l) notFound();
  permanentRedirect(`/inzerat/${l.id}/${l.slug}`);
}
