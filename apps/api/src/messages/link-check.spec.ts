import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { assessMessageSafety, cleanPreview, escapeHtml, extractLinks, foreignPhones, looksLikeLink } from './link-check';
import { directKey, isOwnMediaUrl, messageEmail } from './messages.util';

const OWN = ['dejinzerat.cz', 'localhost'];
const level = (s: string) => assessMessageSafety(s, OWN)?.level ?? null;

describe('podezřelé odkazy ve zprávách', () => {
  it('běžný text bez odkazu nevaruje', () => {
    for (const s of ['Dobrý den, je inzerát ještě aktuální?', 'Cena 1.500 Kč, verze 2.0.1, ok.Jasně', 'Můžu přijet v 17.30 do Brna', 'Volejte 777 123 456 nebo +420 777 123 456', 'Tel. 00421 905 123 456']) {
      assert.equal(level(s), null, s);
    }
  });

  it('napodobeniny dopravců a bank jsou nebezpečné', () => {
    for (const s of [
      'Platbu dokončete na https://zasilkovna-platba.cz/pay',
      'zásilka čeká: zasilkovna.cz.doruceni-online.com/abc',
      'ppl-dorucovani.cz/zasilka/123',
      'Ověřte se na www.dpd-cz.info',
      'ceska-posta.top/balik',
      'balikovna-cz.net',
      'csob-overeni.cz/login',
      'https://moneta-online.net',
      'kb-bezpecnost.com/karta',
      'https://zasilkovna.cz@evil.example.com/pay',
    ]) assert.equal(level(s), 'danger', s);
  });

  it('oficiální domény a naše stránky nevarují', () => {
    for (const s of ['Sledování: https://tracking.packeta.com/cs/?id=Z123', 'https://www.zasilkovna.cz/pobocky', 'Mrkněte na https://dejinzerat.cz/inzerat/abc/kolo', 'video https://youtu.be/xyz']) {
      assert.equal(level(s), null, s);
    }
  });

  it('zkracovače, IP adresy a punycode', () => {
    assert.equal(level('mrkni sem bit.ly/3abc'), 'danger');
    assert.equal(level('https://tinyurl.com/x1'), 'danger');
    assert.equal(level('http://185.23.11.4/platba'), 'danger');
    assert.equal(level('192.168.0.1:8080/x'), 'danger');
    assert.equal(level('https://xn--zsilkovna-c3a.cz/pay'), 'danger');
  });

  it('neznámá doména jen upozorní, s platebními slovy je nebezpečná', () => {
    assert.equal(level('fotky jsou na www.mojefotky.cz'), 'warn');
    assert.equal(level('https://example.com/overeni-platby'), 'danger');
  });

  it('přesun na WhatsApp/Telegram a zahraniční čísla', () => {
    assert.equal(level('Napište mi na WhatsApp'), 'warn');
    assert.equal(level('pište na telegram'), 'warn');
    assert.equal(level('whatsapp +44 7700 900123'), 'danger');
    assert.deepEqual(foreignPhones('volej +234 803 123 4567 nebo +420 777 111 222'), ['+2348031234567']);
    assert.deepEqual(foreignPhones('Cena 1000 Kč, tel 0044 20 7946 0958'), ['+442079460958']);
  });

  it('podvodné obraty s diakritikou', () => {
    for (const s of ['Jsem v zahraničí, pošlu kurýrem po zaplacení', 'Pošlete číslo karty a CVV', 'platba předem na účet', 'Zaplaťte bitcoinem']) assert.equal(level(s), 'danger', s);
  });

  it('varování je česky a má důvody', () => {
    const w = assessMessageSafety('https://zasilkovna-platba.cz/pay', OWN)!;
    assert.match(w.title, /podvod/);
    assert.ok(w.reasons[0].includes('zasilkovna-platba.cz'));
    assert.ok(w.advice.length > 20);
  });

  it('překlepy po tečce, „signal“ a čísla objednávek nejsou poplach', () => {
    for (const s of ['Dobře.Co cena?', 'Dobrý den.Co je to za model?', 'Je to iPhone 13.Pro max', 'Super.Pro mě ideální', 'Tady neni signal, zavolám', 'obj. č. 00123456789', 'napište na jan.novak@seznam.cz']) {
      assert.equal(level(s), null, s);
    }
    assert.equal(level('dobře.co'), 'warn');
    assert.equal(level('pište mi na signal'), 'warn');
    assert.equal(level('tel 00447700900123'), 'danger');
  });

  it('skrytá doména před @ a formuláře Google', () => {
    assert.equal(level('zasilkovna.cz@evil.com'), 'danger');
    assert.equal(level('zásilkovna-platba.cz'), 'danger');
    assert.equal(level('https://zásilkovna.cz/platba'), 'danger');
    assert.equal(level('vyplňte https://docs.google.com/forms/d/xyz'), 'warn');
  });

  it('extractLinks ořízne interpunkci a www', () => {
    assert.deepEqual(extractLinks('(viz www.Example.cz/a).').map((l) => [l.host, l.path]), [['example.cz', '/a']]);
    assert.equal(looksLikeLink('Jan Novák'), false);
    assert.equal(looksLikeLink('Výhra na evil.top'), true);
  });
});

describe('pomocné funkce zpráv', () => {
  it('escapeHtml a cleanPreview', () => {
    assert.equal(escapeHtml('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
    assert.equal(cleanPreview('a‮b\n\n c', 140), 'a b c');
    assert.equal(cleanPreview('x'.repeat(200), 10).length, 10);
  });

  it('e-mail o zprávě escapuje jméno, název i text a riskantní text vynechá', () => {
    const e = messageEmail({ name: '<img src=x onerror=alert(1)>', listingTitle: 'Kolo <b>"top"</b>', body: '<script>alert(1)</script>', risky: false, hasImage: false, url: 'https://dejinzerat.cz/zpravy/1', settingsUrl: 'https://dejinzerat.cz/zpravy' });
    assert.ok(!/<img|<script|<b>/.test(e.html), e.html);
    assert.ok(e.html.includes('&lt;script&gt;'));
    assert.equal(e.subject, 'Nová zpráva k inzerátu „Kolo <b>"top"</b>“'); // předmět je prostý text
    const r = messageEmail({ name: 'Výhra na evil.top', listingTitle: null, body: 'plaťte na bit.ly/x', risky: true, hasImage: false, url: 'u', settingsUrl: 's' });
    assert.ok(!r.html.includes('bit.ly') && !r.html.includes('evil.top') && !r.subject.includes('evil.top'));
    assert.ok(messageEmail({ name: 'Jana', listingTitle: null, body: '', risky: false, hasImage: true, url: 'u', settingsUrl: 's' }).html.includes('fotografii'));
    assert.ok(!messageEmail({ name: 'Jana\r\nBcc: x@y.cz', listingTitle: 'A\r\nB', body: 'x', risky: false, hasImage: false, url: 'u', settingsUrl: 's' }).subject.includes('\n'));
  });

  it('directKey nezávisí na pořadí', () => {
    assert.equal(directKey('b', 'a'), directKey('a', 'b'));
    assert.equal(directKey('a', 'b'), 'a:b');
  });

  it('isOwnMediaUrl přijme jen naše úložiště', () => {
    const env = { s3PublicUrl: 'https://cdn.dejinzerat.cz', blob: true };
    assert.ok(isOwnMediaUrl('/uploads/messages/c1/abc.webp', env));
    assert.ok(isOwnMediaUrl('https://cdn.dejinzerat.cz/messages/c1/abc.webp', env));
    assert.ok(isOwnMediaUrl('https://abcd1234.public.blob.vercel-storage.com/messages/c1/abc.webp', env));
    assert.ok(!isOwnMediaUrl('https://evil.com/messages/x.webp', env));
    assert.ok(!isOwnMediaUrl('https://cdn.dejinzerat.cz.evil.com/messages/x.webp', env));
    assert.ok(!isOwnMediaUrl('/uploads/../etc/passwd', env));
    assert.ok(!isOwnMediaUrl('https://abcd.public.blob.vercel-storage.com/messages/x.webp', { s3PublicUrl: '', blob: false }));
  });
});
