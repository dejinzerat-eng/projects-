import { ldHtml } from '@/lib/jsonld';

/** Strukturovaná data schema.org (JSON-LD). */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldHtml(data) }} />;
}
