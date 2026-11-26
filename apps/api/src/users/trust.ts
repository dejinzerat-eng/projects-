/** Transparentní skóre důvěryhodnosti 0–100, počítané jen z ověřitelných signálů. */
export interface TrustInput {
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Firemní účet (zaškrtnutý uživatelem) */
  isBusiness: boolean;
  /** IČO ověřené v ARES */
  companyVerified: boolean;
  companyId: string | null;
  createdAt: Date;
  ratingCount: number;
  ratingAvg: number | null;
  sold: number;
}

export function trustScore(t: TrustInput, now = Date.now()) {
  const ageDays = Math.max(0, (now - t.createdAt.getTime()) / 864e5);
  const score = Math.round(
    (t.emailVerified ? 15 : 0) + (t.phoneVerified ? 25 : 0) + Math.min(20, ageDays / 18) +
    Math.min(20, t.ratingCount * 4) * ((t.ratingAvg ?? 0) / 5) + Math.min(10, t.sold * 2) + (t.isBusiness && t.companyVerified ? 10 : 0));
  const age = ageDays < 30 ? 'méně než měsíc' : ageDays < 365 ? `${Math.floor(ageDays / 30)} měs.` : `${Math.floor(ageDays / 365)} r.`;
  const breakdown = [
    { label: 'Ověřený e-mail', ok: t.emailVerified },
    { label: 'Ověřený telefon', ok: t.phoneVerified },
    { label: `Na portálu ${age}`, ok: ageDays > 90 },
    { label: `${t.ratingCount} hodnocení po skutečné komunikaci`, ok: t.ratingCount > 0 },
    { label: `${t.sold} prodaných inzerátů`, ok: t.sold > 0 },
    ...(t.isBusiness ? [t.companyVerified && t.companyId
      ? { label: `Firma s IČO ${t.companyId} (ověřeno v ARES)`, ok: true }
      : { label: t.companyId ? 'IČO zatím neověřeno v ARES' : 'Firma bez IČO', ok: false }] : []),
  ];
  return { score: Math.min(100, score), breakdown };
}
