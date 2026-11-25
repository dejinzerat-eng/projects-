import type { Metadata } from 'next';
import { landingMetadata, LandingPage, resolveLanding, type SP } from '@/components/category-landing';

/** Všechny inzeráty z jednoho města, např. /lokalita/ostrava */
type Props = { params: Promise<{ mesto: string }>; searchParams: Promise<SP> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return landingMetadata(await resolveLanding({ city: (await params).mesto }), await searchParams);
}

export default async function Page({ params, searchParams }: Props) {
  return <LandingPage landing={await resolveLanding({ city: (await params).mesto })} searchParams={await searchParams} />;
}
