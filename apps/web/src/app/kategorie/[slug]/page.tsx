import type { Metadata } from 'next';
import { landingMetadata, LandingPage, resolveLanding, type SP } from '@/components/category-landing';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SP> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return landingMetadata(await resolveLanding(await params), await searchParams);
}

export default async function Page({ params, searchParams }: Props) {
  return <LandingPage landing={await resolveLanding(await params)} searchParams={await searchParams} />;
}
