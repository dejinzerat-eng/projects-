import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type { PrismaService } from '../common/prisma.service';
import { normalizePhone } from '../legacy/legacy-map';
import { keepsPhoneConsent } from './phone-consent';

export const PHONE_FORMAT_ERROR = 'Zadejte platné české nebo slovenské číslo, např. +420 777 123 456.';

/** Telefon zadaný při vkládání inzerátu (platí pro celý účet). Prázdné číslo = beze změny čísla. */
export const ContactPhoneFields = {
  phone: z.string().trim().max(30).optional().refine((v) => !v || !!normalizePhone(v), { message: PHONE_FORMAT_ERROR }),
  /** „Neukazovat telefon – komunikovat jen přes zprávy“ */
  hidePhone: z.boolean().optional(),
  /** „Neukazovat e-mail – komunikovat jen přes zprávy“ */
  hideEmail: z.boolean().optional(),
};

/** Volba zobrazení e-mailu u inzerátů. `onlyIfUnset` = nepřepisovat, když se prodejce už rozhodl (odkaz pro existující účet). */
export async function applyEmailVisibility(prisma: PrismaService, userId: string, showEmail: boolean, onlyIfUnset = false) {
  // (NOT s NULL v SQL nefunguje, proto výslovně „nerozhodnuto nebo opačná volba“)
  const r = await prisma.user.updateMany({ where: { id: userId, OR: onlyIfUnset ? [{ showEmail: null }] : [{ showEmail: null }, { showEmail: !showEmail }] }, data: { showEmail } });
  return r.count > 0;
}

interface CurrentPhone { phone: string | null; phoneVerifiedAt: Date | null; showPhone: boolean }
type PhoneUpdate = { phone?: string; phoneVerifiedAt?: null; showPhone?: boolean };

/**
 * Co zapsat do účtu podle telefonu z formuláře. `null` = nic se nemění.
 * - prázdné číslo: číslo zůstává, jen se případně skryje (zaškrtnuté „neukazovat“)
 * - stejné číslo (i v jiném zápisu): mění se jen viditelnost, ověření zůstává
 * - nové číslo: uloží se neověřené; `keepExisting` = účet už jiné číslo má → nepřepisovat (odkaz pro cizí účet)
 */
export function planPhoneUpdate(cur: CurrentPhone, raw: string | undefined, showPhone: boolean, keepExisting = false): PhoneUpdate | null {
  const phone = raw ? normalizePhone(raw) : null;
  if (!phone) return !showPhone && cur.showPhone ? { showPhone: false } : null;
  if (keepsPhoneConsent(cur.phone, phone)) return cur.showPhone !== showPhone ? { showPhone } : null;
  if (keepExisting && cur.phone) return null;
  return { phone, phoneVerifiedAt: null, showPhone };
}

/** Uloží telefon a jeho viditelnost u inzerátů. Číslo ověřené u jiného účtu nepřevezme. */
export async function applyContactPhone(prisma: PrismaService, userId: string, raw: string | undefined, showPhone: boolean, keepExisting = false) {
  const cur = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true, showPhone: true } });
  const data = planPhoneUpdate(cur, raw, showPhone, keepExisting);
  if (!data) return false;
  if (data.phone && await prisma.user.findFirst({ where: { phone: data.phone, phoneVerifiedAt: { not: null }, id: { not: userId } }, select: { id: true } })) {
    throw new BadRequestException({ message: 'Toto číslo už je ověřené u jiného účtu.', field: 'phone' });
  }
  await prisma.user.update({ where: { id: userId }, data });
  return true;
}
