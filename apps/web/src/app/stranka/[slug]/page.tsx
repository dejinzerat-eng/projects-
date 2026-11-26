import type { Metadata } from 'next';
import { cache } from 'react';
import { Markdown, plainText } from '@/components/markdown';
import { api, ApiError } from '@/lib/api';
import { fillTokens, getOperator } from '@/lib/operator';
import { redirectOrNotFound } from '@/lib/redirects';
import { social } from '@/lib/seo';

type P = { slug: string; title: string; content: string; updatedAt: string; description?: string | null; effectiveFrom?: string | null; reviewedAt?: string | null };
type Props = { params: Promise<{ slug: string }> };

const load = cache(async (slug: string) => {
  let p: P;
  try { p = await api<P>(`/pages/${encodeURIComponent(slug)}`, { revalidate: 300, auth: false }); } catch (e) {
    if (e instanceof ApiError && e.status === 404) return redirectOrNotFound(`/stranka/${slug}`);
    throw e;
  }
  return { ...p, content: fillTokens(p.content, await getOperator()) };
});

const date = (d: string) => new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
const DRAFT_RE = /^>\s?\*\*Návrh[^\n]*\n?/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).slug);
  const description = p.description || plainText(p.content.replace(DRAFT_RE, '')).slice(0, 160);
  const path = `/stranka/${p.slug}`;
  return { title: p.title, description, alternates: { canonical: path }, ...social({ title: p.title, description, path }) };
}

export default async function Page({ params }: Props) {
  const p = await load((await params).slug);
  return (
    <article className="container-x max-w-3xl py-10">
      <h1 className="h-display text-3xl font-bold sm:text-4xl">{p.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {p.effectiveFrom ? <>Účinné od {date(p.effectiveFrom)} · </> : null}
        Aktualizováno {date(p.updatedAt)}
        {p.reviewedAt ? <> · Zkontrolováno právníkem {date(p.reviewedAt)}</> : null}
      </p>
      <div className="mt-8"><Markdown source={p.content} /></div>
    </article>
  );
}
