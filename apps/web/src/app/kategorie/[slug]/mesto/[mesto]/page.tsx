import type { Metadata } from 'next';
import { landingMetadata, LandingPage, resolveLanding, type SP } from '@/components/category-landing';

/** Vstupní stránka kategorie v konkrétním městě, např. /kategorie/elektronika/mesto/praha */
type Props = { params: Promise<{ slug: string; mesto: string }>; searchParams: Promise<SP> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug, mesto } = await params;
  return landingMetadata(await resolveLanding({ slug, city: mesto }), await searchParams);
}

export default async function Page({ params, searchParams }: Props) {
  const { slug, mesto } = await params;
  return <LandingPage landing={await resolveLanding({ slug, city: mesto })} searchParams={await searchParams} />;
}
