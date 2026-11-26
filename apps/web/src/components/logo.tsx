import Link from 'next/link';
import { LOGO_PATH_A, LOGO_PATH_B, LOGO_PATH_D, LOGO_VIEWBOX } from './logo-paths';

/** Celé logo „DEJINZERAT.CZ“ (původní tvar z www.dejinzerat.cz). Barvy bere z tokenů --logo-a / --logo-b, takže funguje ve světlém i tmavém režimu. */
export function Wordmark({ className = 'h-7 w-auto', title }: { className?: string; title?: string }) {
  return (
    <svg viewBox={LOGO_VIEWBOX} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path fill="var(--logo-a)" d={LOGO_PATH_A} />
      <path fill="var(--logo-b)" d={LOGO_PATH_B} />
    </svg>
  );
}

/** Ikona: písmeno „D“ z loga na barevné dlaždici (stejná jako ikona v prohlížeči). */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="15" fill="var(--logo-a)" />
      <path fill="#fff" transform="translate(32 32) scale(1.08) translate(-16.45 -31.65)" d={LOGO_PATH_D} />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center" aria-label="Dejinzerat.cz – úvodní stránka">
      <Wordmark className="h-[22px] w-auto sm:h-7" />
    </Link>
  );
}
