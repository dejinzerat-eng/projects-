import { BadRequestException } from '@nestjs/common';
import { AresResult, isValidIco, lookupAres, normalizeIco } from './ico';

export interface CompanyState { isBusiness: boolean; companyId: string | null; companyName: string | null; companyVerifiedAt: Date | null }
export interface CompanyInput { isBusiness?: boolean; companyId?: string; companyName?: string }
export interface CompanyUpdate {
  data: { isBusiness: boolean; companyId?: string | null; companyName?: string | null; companyAddress?: string | null; vatId?: string | null; companyVerifiedAt?: Date | null };
  /** verified = ověřeno v ARES, unverified = ARES neodpověděl (zkusíme později), none = bez IČO / soukromá osoba */
  status: 'verified' | 'unverified' | 'none';
}

const CLEARED = { companyAddress: null, vatId: null, companyVerifiedAt: null };

/**
 * Rozhodne, co se má u účtu uložit o firmě. Nové nebo dosud neověřené IČO projde kontrolním součtem
 * a dotazem do ARES; obchodní jméno a sídlo se pak berou z ARES. Když ARES neodpoví, účet zůstane
 * firemní, ale neověřený (bez odznaku a bodů do skóre).
 */
export async function resolveCompany(cur: CompanyState, dto: CompanyInput, lookup: (ico: string) => Promise<AresResult> = lookupAres, now = new Date()): Promise<CompanyUpdate> {
  const isBusiness = dto.isBusiness ?? cur.isBusiness;
  if (!isBusiness) return { data: { isBusiness: false, companyId: null, companyName: null, ...CLEARED }, status: 'none' };
  const ico = dto.companyId === undefined ? cur.companyId : dto.companyId ? normalizeIco(dto.companyId) : null;
  const typedName = dto.companyName === undefined ? cur.companyName : dto.companyName || null;
  if (!ico) return { data: { isBusiness: true, companyId: null, companyName: typedName, ...CLEARED }, status: 'none' };
  if (!isValidIco(ico)) throw new BadRequestException({ message: 'Neplatné IČO – nesedí kontrolní číslice. Zkontrolujte ho prosím.', field: 'companyId' });
  if (ico === cur.companyId && cur.companyVerifiedAt) return { data: { isBusiness: true }, status: 'verified' };

  const r = await lookup(ico);
  if (r.status === 'found') return { data: { isBusiness: true, companyId: ico, companyName: r.name, companyAddress: r.address, vatId: r.vatId, companyVerifiedAt: now }, status: 'verified' };
  if (r.status === 'not_found') throw new BadRequestException({ message: `IČO ${ico} jsme v registru ARES nenašli. Zkontrolujte ho prosím.`, field: 'companyId' });
  if (r.status === 'ceased') throw new BadRequestException({ message: `Subjekt s IČO ${ico} je v registru ARES veden jako zaniklý.`, field: 'companyId' });
  return { data: { isBusiness: true, companyId: ico, companyName: typedName, ...CLEARED }, status: 'unverified' };
}
