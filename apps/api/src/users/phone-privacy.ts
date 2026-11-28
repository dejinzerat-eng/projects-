/**
 * Telefon prodejce je soukromý údaj: ukáže se jen tehdy, když ho prodejce sám zveřejnil (showPhone),
 * inzerát je aktivní, prodejce není zablokovaný a mezi prodejcem a zájemcem není blokace.
 *
 * Ověření čísla SMS kódem zatím nevyžadujeme (rozhodnutí 2026-11-28: telefon bez ověření).
 * Až bude SMS brána (GoSMS) zapnutá a má se ukazovat jen ověřené číslo, stačí ve Vercelu
 * nastavit PHONE_REQUIRE_VERIFIED=1 – jinde se nic měnit nemusí.
 */
export interface PhoneSeller { phone: string | null; phoneVerifiedAt: Date | null; showPhone: boolean; status?: string }

export const phoneRequiresVerification = () => process.env.PHONE_REQUIRE_VERIFIED === '1';

/** Smí se u inzerátu vůbec nabízet tlačítko „Zobrazit telefon“? */
export const sellerSharesPhone = (u: PhoneSeller, requireVerified = phoneRequiresVerification()) =>
  !!u.phone && (!requireVerified || !!u.phoneVerifiedAt) && u.showPhone && (u.status ?? 'ACTIVE') === 'ACTIVE';

export function canRevealPhone(listingStatus: string, seller: PhoneSeller, blockedEitherWay: boolean) {
  return ['ACTIVE', 'RESERVED'].includes(listingStatus) && sellerSharesPhone(seller) && !blockedEitherWay;
}
