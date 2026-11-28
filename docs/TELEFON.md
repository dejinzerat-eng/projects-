# Telefon a e-mail prodejce u inzerátů

Stav od 2026-11-28: **telefon bez ověření SMS** (rozhodnutí objednatele).

## Kde se telefon zadává
- **Průvodce přidáním inzerátu**, krok „Místo a kontakt“ (přihlášený i bez registrace):
  pole *Telefon* (nepovinné) a dvě samostatná zaškrtávátka *Neukazovat telefon* a *Neukazovat e-mail*
  (komunikovat jen přes osobní zprávy). **Výchozí stav: telefon i e-mail se ukazují**, prodejce je zaškrtnutím skryje.
- **Nastavení účtu → Kontakt u inzerátů**: uložit / změnit / odebrat číslo, *Zobrazovat telefon* a *Zobrazovat e-mail*.
  Nově uložené číslo se ukazuje automaticky.

## E-mail
- Sloupec `User.showEmail`: `null` = prodejce se ještě nerozhodl (neukazuje se; v průvodci je předvoleno „ukazovat“),
  `true` / `false` = jeho volba. Účty založené před touto změnou (včetně importu ze starého webu) mají `null`.
- E-mail se ukáže jen ověřený (potvrzený odkazem) a nikdy zástupná adresa `…@dejinzerat.invalid`.
- U inzerátu tlačítko „Zobrazit e-mail“ (jen přihlášeným, `GET /listings/:id/email`, limit 50 zobrazení denně).

Telefon patří k účtu, ne k jednomu inzerátu – platí pro všechny inzeráty prodejce.
Přijímá se české nebo slovenské číslo, ukládá se jako `+420…` / `+421…`.

## Pravidla
- Číslo se u inzerátu ukáže jen přihlášeným po kliknutí na „Zobrazit telefon“, jen když to prodejce povolil
  (`showPhone`), inzerát je aktivní/rezervovaný a mezi uživateli není blokace.
- Nové číslo je vždy neověřené (`phoneVerifiedAt = null`). Číslo ověřené u jiného účtu převzít nejde.
- Prázdné pole v průvodci číslo nemaže, jen ho skryje. Odebrat ho jde v nastavení.
- Inzerát bez registrace: u nového účtu se číslo uloží hned (ukáže se až po potvrzení e-mailu, kdy je
  inzerát aktivní). Když e-mail už má účet, číslo se zapíše až po kliknutí majitele na odkaz a jen
  pokud účet žádné číslo ještě nemá; volba e-mailu jen pokud se majitel ještě nerozhodl.

## Až bude SMS ověření
Kód pro SMS (GoSMS) zůstává. Po nastavení klíčů `GOSMS_CLIENT_ID` a `GOSMS_CLIENT_SECRET` se v nastavení
objeví ověření kódem a ve skóre důvěryhodnosti řádek „Ověřený telefon“. `PHONE_REQUIRE_VERIFIED=1`
ve Vercelu zapne pravidlo „u inzerátů jen ověřené číslo“.

Kód: `apps/api/src/users/phone-contact.ts`, `phone-privacy.ts`, `users.controller.ts` (`PUT /me/phone`),
`apps/api/src/listings/guest-listing.controller.ts`, `apps/web/src/components/listing-wizard.tsx`,
`seller-settings.tsx`. Testy: `phone-contact.spec.ts`, `phone-privacy.spec.ts`, `guest.spec.ts`.
