import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { resolveCompany } from './company';
import type { AresResult } from './ico';

const none = { isBusiness: false, companyId: null, companyName: null, companyVerifiedAt: null };
const now = new Date('2026-11-25T12:00:00Z');
const ares = (r: AresResult) => { const calls: string[] = []; return { calls, fn: async (ico: string) => { calls.push(ico); return r; } }; };
const found: AresResult = { status: 'found', name: 'Alza.cz a.s.', address: 'Jankovcova 1522/53, Praha 7', vatId: 'CZ27082440' };

describe('resolveCompany', () => {
  it('ověří nové IČO v ARES a převezme jméno a sídlo', async () => {
    const a = ares(found);
    const r = await resolveCompany(none, { isBusiness: true, companyId: '27082440', companyName: 'Cokoli' }, a.fn, now);
    assert.equal(r.status, 'verified');
    assert.deepEqual(r.data, { isBusiness: true, companyId: '27082440', companyName: 'Alza.cz a.s.', companyAddress: 'Jankovcova 1522/53, Praha 7', vatId: 'CZ27082440', companyVerifiedAt: now });
    assert.deepEqual(a.calls, ['27082440']);
  });
  it('odmítne IČO se špatnou kontrolní číslicí bez dotazu do ARES', async () => {
    const a = ares(found);
    await assert.rejects(resolveCompany(none, { isBusiness: true, companyId: '27082441' }, a.fn), BadRequestException);
    assert.equal(a.calls.length, 0);
  });
  it('IČO, které ARES nezná, je chyba', async () => {
    await assert.rejects(resolveCompany(none, { isBusiness: true, companyId: '12345679' }, ares({ status: 'not_found' }).fn), /nenašli/);
  });
  it('při výpadku ARES účet ponechá, ale neověřený', async () => {
    const r = await resolveCompany(none, { isBusiness: true, companyId: '27082440', companyName: 'Moje firma' }, ares({ status: 'error', reason: 'timeout' }).fn);
    assert.equal(r.status, 'unverified');
    assert.equal(r.data.companyVerifiedAt, null);
    assert.equal(r.data.companyName, 'Moje firma');
  });
  it('už ověřené stejné IČO se znovu neověřuje', async () => {
    const a = ares(found);
    const r = await resolveCompany({ isBusiness: true, companyId: '27082440', companyName: 'Alza.cz a.s.', companyVerifiedAt: now }, { isBusiness: true, companyId: '27082440', companyName: 'Přepis' }, a.fn);
    assert.equal(r.status, 'verified');
    assert.deepEqual(r.data, { isBusiness: true });
    assert.equal(a.calls.length, 0);
  });
  it('změna IČO zruší staré ověření', async () => {
    const r = await resolveCompany({ isBusiness: true, companyId: '27082440', companyName: 'Alza.cz a.s.', companyVerifiedAt: now }, { companyId: '26168685' }, ares({ status: 'error', reason: 'x' }).fn);
    assert.equal(r.status, 'unverified');
    assert.equal(r.data.companyId, '26168685');
    assert.equal(r.data.companyVerifiedAt, null);
  });
  it('IČO ověřené u jiného účtu nejde převzít', async () => {
    const a = ares(found);
    await assert.rejects(resolveCompany(none, { isBusiness: true, companyId: '27082440' }, a.fn, now, async (ico) => ico === '27082440'), /jiný účet/);
    assert.equal(a.calls.length, 0);
  });
  it('soukromá osoba firemní údaje nemá', async () => {
    const r = await resolveCompany({ isBusiness: true, companyId: '27082440', companyName: 'X', companyVerifiedAt: now }, { isBusiness: false }, ares(found).fn);
    assert.equal(r.status, 'none');
    assert.equal(r.data.companyId, null);
    assert.equal(r.data.companyVerifiedAt, null);
  });
  it('firemní účet bez IČO uložit nejde', async () => {
    await assert.rejects(resolveCompany(none, { isBusiness: true, companyName: 'Moje firma' }, ares(found).fn), /vyplňte IČO/);
    await assert.rejects(resolveCompany({ ...none, isBusiness: true }, { companyId: '' }, ares(found).fn), /vyplňte IČO/);
  });
  it('neplatné IČO uložené u účtu (např. ukázková data) poradí, jak ho opravit nebo odebrat', async () => {
    const bad = { isBusiness: true, companyId: '27008888', companyName: 'Autobazar', companyVerifiedAt: null };
    await assert.rejects(resolveCompany(bad, { isBusiness: true, companyId: '27008888' }, ares(found).fn), /uložené u vašeho účtu.*soukromou osobu/);
    const r = await resolveCompany(bad, { isBusiness: false, companyId: '27008888' }, ares(found).fn);
    assert.equal(r.status, 'none');
    assert.equal(r.data.companyId, null);
    const fixed = await resolveCompany(bad, { isBusiness: true, companyId: '27082440' }, ares(found).fn, now);
    assert.equal(fixed.status, 'verified');
  });
});
