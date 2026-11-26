import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Jednoduchý a bezpečný Markdown pro informační stránky (bez HTML): ## a ### nadpisy, odstavce,
 * odrážky „- “, číslované seznamy „1. “, upozornění „> “, **tučně**, [odkaz](/cesta) a automatické odkazy na e-maily.
 * Text bez Markdownu se zobrazí jako odstavce – staré stránky fungují beze změny.
 */
type Block = { t: 'h2' | 'h3' | 'p' | 'quote'; text: string } | { t: 'ul' | 'ol'; items: string[] };

export function parseBlocks(src: string): Block[] {
  const out: Block[] = [];
  for (const raw of src.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const chunk = raw.trim();
    if (!chunk) continue;
    const lines = chunk.split('\n');
    if (/^###\s/.test(chunk)) { out.push({ t: 'h3', text: lines[0].replace(/^###\s+/, '') }); if (lines.length > 1) out.push({ t: 'p', text: lines.slice(1).join('\n') }); continue; }
    if (/^##\s/.test(chunk)) { out.push({ t: 'h2', text: lines[0].replace(/^##\s+/, '') }); if (lines.length > 1) out.push({ t: 'p', text: lines.slice(1).join('\n') }); continue; }
    if (lines.every((l) => /^>\s?/.test(l))) { out.push({ t: 'quote', text: lines.map((l) => l.replace(/^>\s?/, '')).join('\n') }); continue; }
    if (lines.every((l) => /^[-*]\s+/.test(l))) { out.push({ t: 'ul', items: lines.map((l) => l.replace(/^[-*]\s+/, '')) }); continue; }
    if (lines.every((l) => /^\d+[.)]\s+/.test(l))) { out.push({ t: 'ol', items: lines.map((l) => l.replace(/^\d+[.)]\s+/, '')) }); continue; }
    out.push({ t: 'p', text: chunk });
  }
  return out;
}

const safeHref = (h: string) => (/^(\/(?!\/)|https?:\/\/|mailto:)/i.test(h) ? h : null);

function inline(text: string, key = ''): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|\n/g;
  let last = 0, i = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const k = `${key}${i++}`;
    if (m[1] !== undefined) nodes.push(<strong key={k} className="font-semibold text-ink">{inline(m[1], `${k}-`)}</strong>);
    else if (m[2] !== undefined) {
      const href = safeHref(m[3]);
      if (!href) nodes.push(m[2]);
      else if (href.startsWith('/')) nodes.push(<Link key={k} href={href} className="font-medium text-brand-ink underline underline-offset-2 hover:text-brand">{m[2]}</Link>);
      else nodes.push(<a key={k} href={href} rel="noopener noreferrer" className="font-medium text-brand-ink underline underline-offset-2 hover:text-brand">{m[2]}</a>);
    } else if (m[4] !== undefined) nodes.push(<a key={k} href={`mailto:${m[4]}`} className="font-medium text-brand-ink underline underline-offset-2">{m[4]}</a>);
    else nodes.push(<br key={k} />);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-4 text-[16.5px] leading-relaxed text-ink-2">
      {parseBlocks(source).map((b, i) => {
        switch (b.t) {
          case 'h2': return <h2 key={i} className="h-display pt-4 text-2xl font-bold text-ink">{inline(b.text)}</h2>;
          case 'h3': return <h3 key={i} className="pt-2 text-lg font-bold text-ink">{inline(b.text)}</h3>;
          case 'quote': return <div key={i} role="note" className="rounded-2xl border border-top/40 bg-top-soft px-4 py-3 text-[15px] text-ink">{inline(b.text)}</div>;
          case 'ul': return <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-muted">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>;
          case 'ol': return <ol key={i} className="list-decimal space-y-1.5 pl-5 marker:text-muted">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>;
          default: return <p key={i}>{inline(b.text)}</p>;
        }
      })}
    </div>
  );
}

/** Prostý text z Markdownu (pro meta popis). */
export function plainText(src: string) {
  return src.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*|^#+\s|^>\s?|^[-*]\s+/gm, '').replace(/\s+/g, ' ').trim();
}
