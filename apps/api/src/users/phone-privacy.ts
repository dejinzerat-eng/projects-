/**
 * Telefon prodejce je soukromý údaj: ukáže se jen tehdy, když ho prodejce sám zveřejnil (showPhone),
 * číslo je ověřené SMS kódem, inzerát je aktivní, prodejce není zablokovaný
 * a mezi prodejcem a zájemcem není blokace.
 */
export interface PhoneSeller { phone: string | null; phoneVerifiedAt: Date | null; showPhone: boolean; status?: string }

/** Smí se u inzerátu vůbec nabízet tlačítko „Zobrazit telefon“? */
export const sellerSharesPhone = (u: PhoneSeller) => !!u.phone && !!u.phoneVerifiedAt && u.showPhone && (u.status ?? 'ACTIVE') === 'ACTIVE';

export function canRevealPhone(listingStatus: string, seller: PhoneSeller, blockedEitherWay: boolean) {
  return ['ACTIVE', 'RESERVED'].includes(listingStatus) && sellerSharesPhone(seller) && !blockedEitherWay;
}
