import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { AppealDto, esc, listingIdFrom, mailTarget, makeRef, NoticeDto, parseTarget, REF_RE, transparencySummary } from './notice.logic';

const ID = 'cmid1h9ax0001abcdefghijkl';
const base = { category: 'PODVOD', targetUrl: `https://dejinzerat.cz/inzerat/${ID}/iphone`, explanation: 'Prodejce chce platbu předem přes Western Union a pak nekomunikuje.', name: 'Jan Novák', email: 'jan@example.cz', goodFaith: true };

describe('NoticeDto (čl. 16 DSA)', () => {
  it('přijme úplné oznámení', () => {
    assert.equal(NoticeDto.safeParse(base).success, true);
  });
  it('vyžaduje prohlášení o dobré víře', () => {
    const r = NoticeDto.safeParse({ ...base, goodFaith: false });
    assert.equal(r.success, false);
    assert.match(r.error!.issues[0].message, /dobré víře/);
  });
  it('vyžaduje jméno a e-mail u běžných kategorií', () => {
    const r = NoticeDto.safeParse({ ...base, name: '', email: '' });
    assert.equal(r.success, false);
    assert.deepEqual(r.error!.issues.map((i) => i.path[0]).sort(), ['email', 'name']);
  });
  it('u sexuálního zneužívání dětí povolí anonymní oznámení', () => {
    assert.equal(NoticeDto.safeParse({ ...base, category: 'ZNEUZITI_DETI', name: '', email: '' }).success, true);
  });
  it('odmítne krátké vysvětlení, neplatnou URL a neznámou kategorii', () => {
    assert.equal(NoticeDto.safeParse({ ...base, explanation: 'podvod' }).success, false);
    assert.equal(NoticeDto.safeParse({ ...base, targetUrl: 'javascript:alert(1)' }).success, false);
    assert.equal(NoticeDto.safeParse({ ...base, category: 'XYZ' }).success, false);
  });
});

describe('parseTarget a listingIdFrom', () => {
  it('rozpozná inzerát a profil', () => {
    assert.deepEqual(parseTarget(`https://dejinzerat.cz/inzerat/${ID}/iphone-15`), { targetType: 'LISTING', targetId: ID });
    assert.deepEqual(parseTarget(`http://localhost:3000/uzivatel/${ID}`), { targetType: 'USER', targetId: ID });
    assert.equal(parseTarget('https://dejinzerat.cz/kategorie/elektronika'), null);
  });
  it('vezme ID i z odkazu', () => {
    assert.equal(listingIdFrom(ID), ID);
    assert.equal(listingIdFrom(`https://dejinzerat.cz/inzerat/${ID}/x`), ID);
    assert.equal(listingIdFrom(`/inzerat/${ID}`), ID);
    assert.equal(listingIdFrom('něco jiného'), null);
  });
});

describe('makeRef', () => {
  it('vytvoří čitelné číslo bez zaměnitelných znaků', () => {
    const r = makeRef('DSA', new Date('2026-05-01'), () => 0);
    assert.equal(r, 'DSA-2026-222222');
    for (let i = 0; i < 200; i++) assert.match(makeRef('NAM'), REF_RE);
    assert.ok(!/[01IOL]/.test(makeRef('DSA').slice(9)));
  });
});

describe('transparencySummary', () => {
  it('spočítá kategorie, stavy a medián doby vyřízení', () => {
    const t = (h: number) => new Date(Date.UTC(2026, 0, 1, h));
    const s = transparencySummary([
      { category: 'PODVOD', status: 'ACTION_TAKEN', createdAt: t(0), decidedAt: t(2) },
      { category: 'PODVOD', status: 'NO_ACTION', createdAt: t(0), decidedAt: t(4) },
      { category: 'JINE', status: 'RECEIVED', createdAt: t(0), decidedAt: null },
    ]);
    assert.deepEqual(s, { total: 3, byCategory: { PODVOD: 2, JINE: 1 }, byStatus: { ACTION_TAKEN: 1, NO_ACTION: 1, RECEIVED: 1 }, decided: 2, medianHours: 3 });
    assert.equal(transparencySummary([]).medianHours, null);
  });
});

describe('ostatní', () => {
  it('AppealDto vyžaduje odůvodnění', () => {
    assert.equal(AppealDto.safeParse({ listing: ID, text: 'nesouhlas' }).success, false);
    assert.equal(AppealDto.safeParse({ listing: ID, text: 'Inzerát neobsahoval nic zakázaného, jde o airsoft.' }).success, true);
  });
  it('esc escapuje HTML', () => {
    assert.equal(esc('<b>"x" & \'y\'</b>'), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  });
});

describe('mailTarget', () => {
  it('v e-mailu ukáže jen adresu našeho webu, cizí odkaz ne', () => {
    assert.equal(mailTarget('https://www.dejinzerat.cz/inzerat/abc/x?utm=1', 'https://dejinzerat.cz'), 'https://dejinzerat.cz/inzerat/abc/x');
    assert.equal(mailTarget('https://podvod.example/login', 'https://dejinzerat.cz'), 'adresa mimo DEJINZERAT.cz (uvedená ve formuláři)');
    assert.equal(mailTarget('https://dejinzerat.cz.podvod.example/', 'https://dejinzerat.cz'), 'adresa mimo DEJINZERAT.cz (uvedená ve formuláři)');
  });
});
