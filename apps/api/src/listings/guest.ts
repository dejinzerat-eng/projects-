import { createHash } from 'crypto';

/**
 * Vložení inzerátu bez předchozí registrace (viz docs/VKLADANI-BEZ-REGISTRACE.md).
 *
 * Návštěvník vyplní průvodce včetně e-mailu. Fotky nahrané bez přihlášení patří prohlížeči (náhodný
 * token v cookie `dej_guest`, v databázi `ListingImage.ownerId = "guest:<sha256 tokenu>"`). Po odeslání
 * se z e-mailu založí účet, inzerát se uloží jako koncept a zveřejní se až po kliknutí na odkaz v e-mailu.
 */
export const GUEST_COOKIE = 'dej_guest';
/** Platnost cookie s fotkami nahranými bez přihlášení (dny). */
export const GUEST_COOKIE_DAYS = 7;
/** Platnost odkazu „Potvrdit e-mail a zveřejnit inzerát“ (hodiny). */
export const GUEST_LINK_HOURS = 72;
/** Nejvýše tolik inzerátů bez přihlášení za hodinu z jedné IP adresy. */
export const GUEST_MAX_PER_IP_HOUR = 5;
/** Nejvýše tolik potvrzovacích e-mailů za hodinu na jednu adresu (ochrana cizí schránky před zahlcením). */
export const GUEST_MAX_MAILS_PER_EMAIL_HOUR = 3;
/** Nejvýše tolik fotek za den z jednoho prohlížeče bez přihlášení. */
export const GUEST_MAX_IMAGES_PER_DAY = 60;
/** Cíl potvrzovacího tokenu (VerificationToken.target) – odliší ho od běžného ověření e-mailu. */
export const LISTING_TARGET_PREFIX = 'listing:';

const GUEST_PREFIX = 'guest:';

/** Vlastník fotek nahraných bez přihlášení (v databázi je jen otisk tokenu, ne token sám). */
export function guestOwner(token: string): string {
  return GUEST_PREFIX + createHash('sha256').update(token).digest('hex');
}

/** Token z cookie musí vypadat jako ten, který jsme vydali (32 bajtů base64url). */
export function validGuestToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{40,64}$/.test(token);
}

export function listingTarget(listingId: string) { return LISTING_TARGET_PREFIX + listingId; }
export function listingIdFromTarget(target: string | null | undefined): string | null {
  return target?.startsWith(LISTING_TARGET_PREFIX) ? target.slice(LISTING_TARGET_PREFIX.length) || null : null;
}

export interface ExistingAccount {
  emailVerifiedAt: Date | null; passwordHash: string | null; googleId: string | null; appleId: string | null;
  legacyId: string | null; status: string;
}

/**
 * Co udělat s e-mailem z formuláře:
 * - `new`   – účet neexistuje → založíme ho,
 * - `reuse` – účet založený dřív stejným způsobem, ale nikdy nepotvrzený (bez hesla, bez Google/Apple,
 *             nepřevzatý ze starého webu) → inzerát přidáme k němu a pošleme nový potvrzovací odkaz,
 * - `login` – skutečný účet někoho → nic nezakládáme, uživatel se musí přihlásit (nikdo cizí mu nesmí
 *             vložit inzerát do účtu jen tím, že zná jeho e-mail).
 */
export function guestAccountDecision(existing: ExistingAccount | null): 'new' | 'reuse' | 'login' {
  if (!existing) return 'new';
  const unclaimed = !existing.emailVerifiedAt && !existing.passwordHash && !existing.googleId && !existing.appleId && !existing.legacyId;
  return unclaimed && existing.status === 'ACTIVE' ? 'reuse' : 'login';
}

/** Jméno z formuláře; když chybí, použijeme část e-mailu před zavináčem. */
export function guestName(name: string | undefined, email: string): string {
  const n = (name ?? '').trim().replace(/\s+/g, ' ');
  if (n.length >= 2) return n.slice(0, 60);
  const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return (local.length >= 2 ? local : 'Uživatel').slice(0, 60);
}
