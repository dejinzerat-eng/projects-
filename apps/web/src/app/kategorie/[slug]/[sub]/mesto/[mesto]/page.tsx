import type { Metadata } from 'next';
import { landingMetadata, LandingPage, resolveLanding, type SP } from '@/components/category-landing';

/** Vstupní stránka podkategorie v konkrétním městě, např. /kategorie/reality/byty-na-prodej/mesto/brno */
type Props = { params: Promise<{ slug: string; sub: string; mesto: string }>; searchParams: Promise<SP> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug, sub, mesto } = await params;
  return landingMetadata(await resolveLanding({ slug, sub, city: mesto }), await searchParams);
}

export default async function Page({ params, searchParams }: Props) {
  const { slug, sub, mesto } = await params;
  return <LandingPage landing={await resolveLanding({ slug, sub, city: mesto })} searchParams={await searchParams} />;
}
