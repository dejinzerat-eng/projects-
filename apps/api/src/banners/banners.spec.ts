import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { BannerFields, validBannerLink } from './banners.logic';

describe('validBannerLink', () => {
  it('přijme https/http adresu a cestu na našem webu', () => {
    for (const v of ['https://firma.cz', 'https://firma.cz/akce?utm_source=dej', 'http://stary-web.cz', '/kategorie/auto-moto', '/']) assert.equal(validBannerLink(v), true, v);
  });
  it('odmítne javascript:, data:, adresu bez protokolu, //cizí-doménu a přihlašovací údaje v URL', () => {
    for (const v of ['javascript:alert(1)', 'data:text/html,x', 'firma.cz', '//evil.cz', 'https://user:pass@firma.cz', 'ftp://firma.cz', 'https://firma.cz/a b']) assert.equal(validBannerLink(v), false, v);
  });
});

describe('BannerFields', () => {
  it('formulář (multipart) – text přepínače převede na boolean, prázdný odkaz na null', () => {
    const r = BannerFields.parse({ alt: '  Jarní akce  ', linkUrl: '  ', active: 'false' });
    assert.deepEqual(r, { alt: 'Jarní akce', linkUrl: null, active: false });
    assert.equal(BannerFields.parse({ alt: 'Akce', active: 'on' }).active, true);
  });
  it('vyžaduje popis a hlídá odkaz', () => {
    assert.equal(BannerFields.safeParse({ alt: '' }).success, false);
    const bad = BannerFields.safeParse({ alt: 'Akce', linkUrl: 'javascript:alert(1)' });
    assert.equal(bad.success, false);
    assert.match(bad.error!.issues[0].message, /https:\/\//);
  });
  it('úprava (partial) smí poslat jen část polí', () => {
    assert.deepEqual(BannerFields.partial().parse({ active: 'true' }), { active: true });
  });
});
