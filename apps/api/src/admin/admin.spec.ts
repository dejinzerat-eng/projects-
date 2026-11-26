import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { can, ROLE_PERMISSIONS, ROLES } from '@dej/shared';
import { AUDIT_TEXT_MAX, compactValue, diff, validIco } from './audit';
import { groupReports } from './reports.service';
import { envDefaults, mergeSettings, SettingsSchema } from './settings.service';
import { checkRoleChange, checkStatusChange } from './staff-policy';
import { autoRestrictReason } from './trust.service';

const sa = { id: 'sa', role: 'SUPERADMIN' }, admin = { id: 'ad', role: 'ADMIN' }, mod = { id: 'mo', role: 'MODERATOR' }, sup = { id: 'su', role: 'SUPPORT' }, biz = { id: 'bm', role: 'BUSINESS_MANAGER' };
const user = (role = 'USER', status = 'ACTIVE', id = 'u1') => ({ id, role, status });

describe('mapa oprávnění', () => {
  it('každá role má vlastní sadu oprávnění', () => {
    const sets = ROLES.map((r) => [...ROLE_PERMISSIONS[r]].sort().join(','));
    assert.equal(new Set(sets).size, ROLES.length);
  });
  it('běžný uživatel nemá do administrace přístup', () => assert.equal(can('USER', 'admin.access'), false));
  it('všechny role týmu vstoupí do administrace', () => { for (const r of ROLES.filter((x) => x !== 'USER')) assert.ok(can(r, 'admin.access'), r); });
  it('jen hlavní administrátor spravuje administrátory a nastavení', () => {
    assert.ok(can('SUPERADMIN', 'admins.manage') && can('SUPERADMIN', 'settings.manage'));
    assert.ok(!can('ADMIN', 'admins.manage') && !can('ADMIN', 'settings.manage'));
  });
  it('moderátor blokuje uživatele, podpora jen odblokuje a čte', () => {
    assert.ok(can('MODERATOR', 'users.block') && can('MODERATOR', 'reports.handle'));
    assert.ok(can('SUPPORT', 'users.unblock') && can('SUPPORT', 'reports.read'));
    assert.ok(!can('SUPPORT', 'users.block') && !can('SUPPORT', 'reports.handle') && !can('SUPPORT', 'listings.moderate'));
  });
  it('správce obchodních účtů spravuje firmy a propagaci, ne moderaci', () => {
    assert.ok(can('BUSINESS_MANAGER', 'businesses.manage') && can('BUSINESS_MANAGER', 'listings.promote'));
    assert.ok(!can('BUSINESS_MANAGER', 'listings.moderate') && !can('BUSINESS_MANAGER', 'users.block'));
  });
  it('neznámá role nemá nic', () => assert.equal(can('HACKER', 'admin.access'), false));
});

describe('změna role', () => {
  it('nikdo nemění vlastní roli', () => assert.match(checkRoleChange(sa, user('SUPERADMIN', 'ACTIVE', 'sa'), 'USER', 2)!, /vlastní/));
  it('administrátor přidělí moderátora, ale ne administrátora', () => {
    assert.equal(checkRoleChange(admin, user(), 'MODERATOR', 1), null);
    assert.match(checkRoleChange(admin, user(), 'ADMIN', 1)!, /hlavní administrátor/);
    assert.match(checkRoleChange(admin, user('ADMIN', 'ACTIVE', 'a2'), 'USER', 1)!, /hlavní administrátor/);
  });
  it('hlavní administrátor smí jmenovat administrátora i dalšího hlavního', () => {
    assert.equal(checkRoleChange(sa, user(), 'ADMIN', 1), null);
    assert.equal(checkRoleChange(sa, user(), 'SUPERADMIN', 1), null);
  });
  it('posledního hlavního administrátora nelze odebrat', () => {
    assert.match(checkRoleChange(sa, user('SUPERADMIN', 'ACTIVE', 's2'), 'ADMIN', 1)!, /Posledního/);
    assert.equal(checkRoleChange(sa, user('SUPERADMIN', 'ACTIVE', 's2'), 'ADMIN', 2), null);
    // zablokovaný hlavní administrátor se do počtu aktivních nepočítá
    assert.equal(checkRoleChange(sa, user('SUPERADMIN', 'BLOCKED', 's2'), 'ADMIN', 1), null);
  });
  it('moderátor role nemění', () => assert.match(checkRoleChange(mod, user(), 'MODERATOR', 1)!, /oprávnění/));
});

describe('blokace a omezení', () => {
  it('nikdo nezablokuje sám sebe', () => assert.match(checkStatusChange(sa, user('SUPERADMIN', 'ACTIVE', 'sa'), 'BLOCKED', 3)!, /sami sebe/));
  it('moderátor zablokuje běžného uživatele, ne člena týmu', () => {
    assert.equal(checkStatusChange(mod, user(), 'BLOCKED', 1), null);
    assert.match(checkStatusChange(mod, user('SUPPORT'), 'BLOCKED', 1)!, /administrátor/);
  });
  it('podpora odblokuje, ale neblokuje', () => {
    assert.equal(checkStatusChange(sup, user('USER', 'BLOCKED'), 'ACTIVE', 1), null);
    assert.match(checkStatusChange(sup, user(), 'BLOCKED', 1)!, /oprávnění/);
  });
  it('zrušit omezení smí moderátor, ne podpora', () => {
    assert.equal(checkStatusChange(mod, user('USER', 'RESTRICTED'), 'ACTIVE', 1), null);
    assert.match(checkStatusChange(sup, user('USER', 'RESTRICTED'), 'ACTIVE', 1)!, /oprávnění/);
  });
  it('administrátor neblokuje administrátora, hlavní ano', () => {
    assert.match(checkStatusChange(admin, user('ADMIN', 'ACTIVE', 'a2'), 'BLOCKED', 1)!, /hlavní administrátor/);
    assert.equal(checkStatusChange(sa, user('ADMIN', 'ACTIVE', 'a2'), 'BLOCKED', 1), null);
  });
  it('posledního hlavního administrátora nelze zablokovat', () => {
    assert.match(checkStatusChange(sa, user('SUPERADMIN', 'ACTIVE', 's2'), 'BLOCKED', 1)!, /Posledního/);
    assert.equal(checkStatusChange(sa, user('SUPERADMIN', 'ACTIVE', 's2'), 'BLOCKED', 2), null);
  });
  it('správce obchodních účtů neblokuje', () => assert.ok(checkStatusChange(biz, user(), 'BLOCKED', 1)));
  it('administrátorský účet nelze omezit', () => assert.match(checkStatusChange(sa, user('ADMIN', 'ACTIVE', 'a2'), 'RESTRICTED', 2)!, /nelze omezit/));
});

describe('automatické omezení', () => {
  it('3 různí oznamovatelé za 7 dní', () => {
    assert.equal(autoRestrictReason({ distinctReporters: 2 }), null);
    assert.match(autoRestrictReason({ distinctReporters: 3 })!, /3 různými/);
  });
  it('vysoce rizikový obsah', () => {
    assert.equal(autoRestrictReason({ riskScore: 60 }), null);
    assert.match(autoRestrictReason({ riskScore: 80, riskWhat: 'inzerát „X“' })!, /skóre 80.*X/);
  });
  it('3 podezřelé zprávy za den', () => {
    assert.equal(autoRestrictReason({ flaggedMessages24h: 2 }), null);
    assert.ok(autoRestrictReason({ flaggedMessages24h: 3 }));
  });
});

describe('nastavení', () => {
  const d = envDefaults({});
  it('bez DB platí výchozí hodnoty', () => assert.deepEqual(mergeSettings(d, []), d));
  it('uložené hodnoty mají přednost, neplatné a neznámé se ignorují', () => {
    const s = mergeSettings(d, [{ key: 'listingDays', value: 60 }, { key: 'premoderation', value: 'ano' }, { key: 'xyz', value: 1 }, { key: 'freeActiveListings', value: 5 }]);
    assert.equal(s.listingDays, 60); assert.equal(s.premoderation, d.premoderation); assert.equal(s.freeActiveListings, 5);
    assert.equal((s as Record<string, unknown>).xyz, undefined);
  });
  it('validuje IČO a e-mail podpory', () => {
    assert.equal(SettingsSchema.partial().safeParse({ operatorIco: '123' }).success, false);
    assert.equal(SettingsSchema.partial().safeParse({ supportEmail: 'neplatny' }).success, false);
    assert.equal(SettingsSchema.partial().safeParse({ operatorIco: '', supportEmail: '' }).success, true);
  });
  it('výchozí hodnoty z prostředí', () => {
    const e = envDefaults({ SUPPORT_EMAIL: 'help@x.cz', FREE_ACTIVE_LISTINGS: '10', MAX_LISTINGS_PER_HOUR: 'abc' });
    assert.equal(e.supportEmail, 'help@x.cz'); assert.equal(e.freeActiveListings, 10); assert.equal(e.maxListingsPerHour, 20);
  });
});

describe('sloučení duplicitních nahlášení', () => {
  const r = (id: string, t: string, reporter: string, min: number) => ({ id, targetType: 'LISTING', targetId: t, reporterId: reporter, createdAt: new Date(Date.UTC(2026, 0, 1, 0, min)) });
  it('seskupí podle cíle a seřadí podle počtu oznamovatelů', () => {
    const g = groupReports([r('1', 'A', 'x', 1), r('2', 'B', 'x', 5), r('3', 'A', 'y', 2), r('4', 'A', 'y', 3)]);
    assert.deepEqual(g.map((x) => [x.targetId, x.count, x.distinctReporters]), [['A', 3, 2], ['B', 1, 1]]);
    assert.equal(g[0].lastAt.getUTCMinutes(), 3);
  });
});

describe('pomocné funkce', () => {
  it('IČO s kontrolním součtem', () => {
    assert.ok(validIco('45274649'));
    assert.ok(validIco('00006947'));
    assert.ok(!validIco('45274648'));
    assert.ok(!validIco('1234567'));
  });
  it('diff vrací jen změněná pole', () => {
    assert.deepEqual(diff({ a: 1, b: 'x', c: null }, { a: 1, b: 'y', c: undefined }), { b: { from: 'x', to: 'y' } });
  });
  it('diff do auditu zkrátí dlouhé texty a data uloží jako ISO', () => {
    const long = 'a'.repeat(5000);
    const d = diff({ description: long, topUntil: null as Date | null }, { description: `${long}b`, topUntil: new Date('2026-12-03T10:00:00Z') });
    assert.equal(String(d.description.from).length < AUDIT_TEXT_MAX + 30, true);
    assert.match(String(d.description.to), /… \(5001 znaků\)$/);
    assert.deepEqual(d.topUntil, { from: null, to: '2026-12-03T10:00:00.000Z' });
    assert.equal(compactValue('krátký'), 'krátký');
    assert.equal(compactValue(undefined), null);
  });
});
