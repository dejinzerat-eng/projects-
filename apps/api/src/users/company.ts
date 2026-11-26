import { BadRequestException } from '@nestjs/common';
import { AresResult, isValidIco, lookupAres, normalizeIco } from './ico';

export interface CompanyState { isBusiness: boolean; companyId: string | null; companyName: string | null; companyVerifiedAt: Date | null }
export interface CompanyInput { isBusiness?: boolean; companyId?: string; companyName?: string }
export interface CompanyUpdate {
  data: { isBusiness: boolean; companyId?: string | null; companyName?: string | null; companyAddress?: string | null; vatId?: string | null; companyVerifiedAt?: Date | null };
  /** verified = ověřeno v ARES, unverified = ARES neodpověděl (zkusíme později), none = soukromá osoba */
  status: 'verified' | 'unverified' | 'none';
}

const CLEARED = { companyAddress: null, vatId: null, companyVerifiedAt: null };

/**
 * Rozhodne, co se má u účtu uložit o firmě. Firemní účet musí mít IČO. Nové nebo dosud neověřené IČO projde kontrolním součtem
 * a dotazem do ARES; obchodní jméno a sídlo se pak berou z ARES. Když ARES neodpoví, účet zůstane
 * firemní, ale neověřený (bez odznaku a bodů do skóre).
 */
export async function resolveCompany(
  cur: CompanyState, dto: CompanyInput, lookup: (ico: string) => Promise<AresResult> = lookupAres, now = new Date(),
  /** Má toto IČO už ověřené jiný účet? (jedno ověřené IČO = jeden účet, ochrana před vydáváním se za cizí firmu) */
  isTaken: (ico: string) => Promise<boolean> = async () => false,
): Promise<CompanyUpdate> {
  const isBusiness = dto.isBusiness ?? cur.isBusiness;
  if (!isBusiness) return { data: { isBusiness: false, companyId: null, companyName: null, ...CLEARED }, status: 'none' };
  const ico = dto.companyId === undefined ? cur.companyId : dto.companyId ? normalizeIco(dto.companyId) : null;
  const typedName = dto.companyName === undefined ? cur.companyName : dto.companyName || null;
  if (!ico) throw new BadRequestException({ message: 'Pro firemní účet vyplňte IČO (8 číslic). Pokud neprodáváte jako firma nebo podnikatel, zvolte soukromou osobu.', field: 'companyId' });
  if (!isValidIco(ico)) {
    throw new BadRequestException({
      message: ico === cur.companyId
        ? `IČO ${ico} uložené u vašeho účtu není platné (nesedí kontrolní číslice). Opravte ho podle výpisu v ARES, nebo účet přepněte na soukromou osobu (zrušte volbu „Prodávám jako firma / podnikatel“) a profil uložte.`
        : 'Neplatné IČO – nesedí kontrolní číslice. Zkontrolujte ho prosím.',
      field: 'companyId',
    });
  }
  if (ico === cur.companyId && cur.companyVerifiedAt) return { data: { isBusiness: true }, status: 'verified' };

  if (await isTaken(ico)) throw new BadRequestException({ message: `IČO ${ico} už má ověřené jiný účet. Pokud jde o vaši firmu, kontaktujte prosím podporu Dejinzerat.cz.`, field: 'companyId' });

  const r = await lookup(ico);
  if (r.status === 'found') return { data: { isBusiness: true, companyId: ico, companyName: r.name, companyAddress: r.address, vatId: r.vatId, companyVerifiedAt: now }, status: 'verified' };
  if (r.status === 'not_found') throw new BadRequestException({ message: `IČO ${ico} jsme v registru ARES nenašli. Zkontrolujte ho prosím.`, field: 'companyId' });
  if (r.status === 'ceased') throw new BadRequestException({ message: `Subjekt s IČO ${ico} je v registru ARES veden jako zaniklý.`, field: 'companyId' });
  return { data: { isBusiness: true, companyId: ico, companyName: typedName, ...CLEARED }, status: 'unverified' };
}

/** IČO smí mít ověřené jen jeden aktivní účet (exceptUserId = účet, který IČO právě ukládá). */
export const icoTakenCheck = (prisma: { user: { findFirst(args: object): Promise<unknown> } }, exceptUserId?: string) =>
  async (ico: string) => !!(await prisma.user.findFirst({ where: { companyId: ico, companyVerifiedAt: { not: null }, status: 'ACTIVE', ...(exceptUserId ? { id: { not: exceptUserId } } : {}) }, select: { id: true } }));
