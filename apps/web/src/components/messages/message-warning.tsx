import { AlertTriangle, Info } from 'lucide-react';

export interface MessageWarningData { level: 'danger' | 'warn'; title: string; reasons: string[]; advice: string }

/** Varování u zprávy s podezřelým odkazem, číslem nebo obratem (vidí ho jen příjemce). */
export function MessageWarning({ w }: { w: MessageWarningData }) {
  const danger = w.level === 'danger';
  const Icon = danger ? AlertTriangle : Info;
  return (
    <div role="note" className={`mt-1 max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed sm:max-w-[80%] ${danger ? 'bg-danger-soft text-danger' : 'border border-line bg-surface-2 text-ink-2'}`}>
      <p className="flex items-start gap-1.5 font-semibold"><Icon className="size-4 shrink-0" aria-hidden />{w.title}</p>
      {w.reasons.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-6">{w.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
      <p className="mt-1 pl-[22px]">{w.advice}</p>
    </div>
  );
}
