import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { emailLayout } from './mailer.service';

describe('vzhled e-mailů', () => {
  const html = emailLayout('<p>Obnova hesla</p>', 'https://www.dejinzerat.cz');
  it('má nahoře logo DEJINZERAT.CZ jako PNG z webu', () => {
    assert.match(html, /<img src="https:\/\/www\.dejinzerat\.cz\/email\/logo\.png"[^>]*alt="DEJINZERAT\.CZ"/);
    assert.ok(html.indexOf('logo.png') < html.indexOf('Obnova hesla'));
  });
  it('obsah zůstane beze změny a patička ukazuje adresu webu', () => {
    assert.ok(html.includes('<p>Obnova hesla</p>'));
    assert.match(html, />www\.dejinzerat\.cz<\/a>/);
  });
});
