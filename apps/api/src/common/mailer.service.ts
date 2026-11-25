import { Injectable, Logger } from '@nestjs/common';
import { config } from './config';

/** Odesílání e-mailů přes Resend API. Bez klíče se e-maily jen vypisují do logu (vývoj). */
@Injectable()
export class MailerService {
  private log = new Logger('Mailer');
  async send(to: string, subject: string, html: string) {
    if (!config.resendKey) { this.log.log(`[DEV e-mail] ${to} | ${subject}\n${html.replace(/<[^>]+>/g, ' ')}`); return; }
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${config.resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.mailFrom, to, subject, html }),
    });
    if (!r.ok) this.log.error(`E-mail se nepodařilo odeslat: ${r.status} ${await r.text()}`);
  }
}

/** SMS pro ověření telefonu. Poskytovatel (např. SMSbrána.cz, GoSMS) se doplní; zatím se kód vypisuje do logu. */
@Injectable()
export class SmsService {
  private log = new Logger('SMS');
  async send(phone: string, text: string) { this.log.log(`[DEV SMS] ${phone}: ${text}`); }
}
