import { BadRequestException, Logger } from '@nestjs/common';
import { config } from './config';

/** CAPTCHA je zapnutá, jen když je nastavený tajný klíč i klíč webu (widget a ověření musí jít spolu). */
export const captchaEnabled = () => !!(config.turnstileSecret && config.turnstileSiteKey);

const log = new Logger('Captcha');
let warned = false;

/** Ověření Cloudflare Turnstile (CAPTCHA). Bez nastavených klíčů se přeskočí. */
export async function verifyCaptcha(token: string | undefined, ip?: string) {
  if (!captchaEnabled()) {
    if ((config.turnstileSecret || config.turnstileSiteKey) && !warned) { warned = true; log.warn('Turnstile: nastavte TURNSTILE_SECRET i TURNSTILE_SITE_KEY, jinak se CAPTCHA neověřuje.'); }
    return;
  }
  if (!token) throw new BadRequestException('Potvrďte prosím, že nejste robot.');
  const body = new URLSearchParams({ secret: config.turnstileSecret!, response: token, ...(ip ? { remoteip: ip } : {}) });
  let ok = false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    ok = ((await r.json()) as { success?: boolean }).success === true;
  } catch (e) {
    log.error(`Turnstile nedostupný: ${(e as Error).message}`);
  }
  if (!ok) throw new BadRequestException('Ověření proti robotům selhalo, zkuste to znovu.');
}
