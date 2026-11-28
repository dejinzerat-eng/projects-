import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { GuestListingDto } from './guest-listing.controller';
import { guestAccountDecision, guestName, guestOwner, listingIdFromTarget, listingTarget, pendingFromTarget, pendingTarget, validGuestToken } from './guest';

const account = { emailVerifiedAt: null, passwordHash: null, googleId: null, appleId: null, legacyId: null, status: 'ACTIVE' };

describe('guestAccountDecision', () => {
  it('nový e-mail → nový účet', () => assert.equal(guestAccountDecision(null), 'new'));
  it('nikdy nepotvrzený účet z formuláře se použije znovu', () => assert.equal(guestAccountDecision(account), 'reuse'));
  it('skutečný účet vyžaduje přihlášení', () => {
    assert.equal(guestAccountDecision({ ...account, emailVerifiedAt: new Date() }), 'login');
    assert.equal(guestAccountDecision({ ...account, passwordHash: 'x' }), 'login');
    assert.equal(guestAccountDecision({ ...account, googleId: 'g' }), 'login');
    assert.equal(guestAccountDecision({ ...account, appleId: 'a' }), 'login');
  });
  it('účet převzatý ze starého webu se nepoužije bez přihlášení', () => assert.equal(guestAccountDecision({ ...account, legacyId: 'dejinzerat:1' }), 'login'));
  it('omezený nebo zablokovaný účet se nepoužije', () => {
    assert.equal(guestAccountDecision({ ...account, status: 'BLOCKED' }), 'login');
    assert.equal(guestAccountDecision({ ...account, status: 'RESTRICTED' }), 'login');
  });
});

describe('fotky bez přihlášení', () => {
  it('vlastník je otisk tokenu, ne token sám', () => {
    const t = 'a'.repeat(43);
    assert.match(guestOwner(t), /^guest:[0-9a-f]{64}$/);
    assert.ok(!guestOwner(t).includes(t));
    assert.equal(guestOwner(t), guestOwner(t));
    assert.notEqual(guestOwner(t), guestOwner('b'.repeat(43)));
  });
  it('přijme jen token, který jsme mohli vydat', () => {
    assert.ok(validGuestToken('Ab-_'.repeat(11)));
    assert.ok(!validGuestToken(undefined));
    assert.ok(!validGuestToken('krátký'));
    assert.ok(!validGuestToken('x'.repeat(43) + ';'));
    assert.ok(!validGuestToken(['a'.repeat(43)]));
  });
});

describe('cíl potvrzovacího odkazu', () => {
  it('pozná odkaz k inzerátu', () => {
    assert.equal(listingIdFromTarget(listingTarget('abc')), 'abc');
    assert.equal(listingIdFromTarget(null), null);
    assert.equal(listingIdFromTarget('novy@email.cz'), null);
    assert.equal(listingIdFromTarget('listing:'), null);
  });
  it('inzerát pro existující účet čeká v tokenu', () => {
    const p = { listing: { title: 'Kolo' }, guestOwner: 'guest:abc' };
    assert.deepEqual(pendingFromTarget(pendingTarget(p)), p);
    assert.equal(listingIdFromTarget(pendingTarget(p)), null);
    assert.equal(pendingFromTarget(listingTarget('x')), null);
    assert.equal(pendingFromTarget('pending:{rozbité'), null);
    assert.equal(pendingFromTarget('pending:null'), null);
  });
  it('telefon z formuláře čeká v tokenu spolu s inzerátem', () => {
    const p = { listing: { title: 'Kolo' }, guestOwner: null, contact: { phone: '777123456', showPhone: false, showEmail: true } };
    assert.deepEqual(pendingFromTarget(pendingTarget(p)), p);
  });
});

describe('guestName', () => {
  it('jméno z formuláře, jinak z e-mailu', () => {
    assert.equal(guestName('  Jan   Novák ', 'x@y.cz'), 'Jan Novák');
    assert.equal(guestName('', 'petr.svoboda@seznam.cz'), 'petr svoboda');
    assert.equal(guestName(undefined, 'a@b.cz'), 'Uživatel');
    assert.equal(guestName('x'.repeat(80), 'a@b.cz').length, 60);
  });
});

describe('GuestListingDto', () => {
  const ok = { title: 'Kolo Author 26"', description: 'Pěkné horské kolo, málo jeté.', categorySlug: 'sport', subSlug: 'kola', city: 'Brno', email: 'jan@example.cz', terms: true };
  it('vyžaduje e-mail a souhlas', () => {
    assert.ok(GuestListingDto.safeParse(ok).success);
    assert.ok(!GuestListingDto.safeParse({ ...ok, email: 'neni-email' }).success);
    assert.ok(!GuestListingDto.safeParse({ ...ok, terms: false }).success);
    const { terms: _t, ...noTerms } = ok;
    assert.ok(!GuestListingDto.safeParse(noTerms).success);
  });
  it('kontroluje inzerát stejně jako zveřejnění', () => {
    assert.ok(!GuestListingDto.safeParse({ ...ok, title: 'Kolo' }).success);
    assert.ok(!GuestListingDto.safeParse({ ...ok, description: 'krátký' }).success);
    assert.ok(!GuestListingDto.safeParse({ ...ok, city: '' }).success);
  });
});
