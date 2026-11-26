/** Číslo v jednotném tvaru pro porovnání (jen číslice, české číslo bez předvolby dostane 420). */
const phoneKey = (p: string) => { const d = p.replace(/\D/g, ''); return d.length === 9 ? `420${d}` : d; };

/**
 * Souhlas se zobrazením telefonu u inzerátů (showPhone) platí pro konkrétní číslo. Když si uživatel
 * ověří jiné číslo, než měl dosud, zobrazení se vypne a pro nové číslo ho musí zapnout znovu sám.
 */
export const keepsPhoneConsent = (previous: string | null | undefined, verified: string) => !!previous && phoneKey(previous) === phoneKey(verified);
