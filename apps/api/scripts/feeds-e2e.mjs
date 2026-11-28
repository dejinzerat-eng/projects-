// Import nabídek partnerů přes XML feed – celý průběh proti falešnému webu partnera a skutečné databázi (po `pnpm seed`):
// založení partnera, náhled, synchronizace s fotkami, schválení, opakování bez duplicit, změny ve feedu, úprava moderátorem,
// zmizelé a vrácené nabídky, rozbitý feed, rizikový obsah, automatická synchronizace (cron), pozvánka a smazání partnera.
// Spuštění: `pnpm --filter @dej/api feeds:e2e` (GitHub kontrola ho pouští po smoke testu). Na konci po sobě vše uklidí.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PARTNER_EMAIL = 'autobazar.feeds-e2e@example.cz';

// ---------- falešný web partnera ----------
let cars = [
  { id: 'E2E-1', brand: 'Škoda', model: 'Octavia Combi 2.0 TDI', year: '2018', km: '125 000', fuel: 'nafta', price: '289000', photos: ['1a', '1b'] },
  { id: 'E2E-2', brand: 'Toyota', model: 'Yaris 1.5 Hybrid', year: '2020', km: '54000', fuel: 'hybrid', price: '329 900 Kč', photos: ['2a'] },
  { id: 'E2E-3', brand: 'Ford', model: 'Transit Custom', year: '2019', km: '160000', fuel: 'nafta', price: '419000', photos: [], kind: 'Užitkové vozy' },
];
let broken = false;
const xml = () => `<?xml version="1.0" encoding="UTF-8"?>
<export><vozidla>${cars.map((c) => `
  <vozidlo id="${c.id}">
    <druh>${c.kind ?? 'Osobní automobily'}</druh>
    <znacka>${c.brand}</znacka><model>${c.model}</model><rok_vyroby>${c.year}</rok_vyroby><najeto>${c.km}</najeto><palivo>${c.fuel}</palivo>
    <cena>${c.price}</cena><popis><![CDATA[<p>${c.text ?? 'Servisní knížka, nehavarováno.'}</p>]]></popis>
    <odkaz>/nabidka/${c.id}</odkaz>
    <fotky>${c.photos.map((p) => `<foto url="/img/${p}.jpg"/>`).join('')}</fotky>
  </vozidlo>`).join('')}
</vozidla></export>`;
const img = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 30, g: 120, b: 200 } } }).jpeg().toBuffer();
let imageHits = 0;
let feedHits = 0;
const partner = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/feed.xml') {
    feedHits++;
    if (broken) { res.setHeader('content-type', 'text/html'); return res.end('<html><body>Chyba 500 v e-shopu</body></html>'); }
    res.setHeader('content-type', 'application/xml; charset=utf-8');
    return res.end(xml());
  }
  if (u.pathname.startsWith('/img/')) { imageHits++; res.setHeader('content-type', 'image/jpeg'); return res.end(img); }
  res.statusCode = 404; res.end();
});
const mails = [];
const resend = createServer((req, res) => {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', () => { mails.push(JSON.parse(body)); res.setHeader('content-type', 'application/json'); res.end('{"id":"test"}'); });
});
await new Promise((ok) => partner.listen(0, '127.0.0.1', ok));
await new Promise((ok) => resend.listen(0, '127.0.0.1', ok));
const feedUrl = `http://127.0.0.1:${partner.address().port}/feed.xml`;

// ---------- API ----------
const port = process.env.FEEDS_E2E_PORT ?? '4120';
const base = `http://127.0.0.1:${port}`;
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = spawn(process.execPath, ['dist/main.js'], {
  env: {
    ...process.env, PORT: port, DISABLE_JOBS: '1', MEILI_URL: '', FEED_ALLOW_PRIVATE: '1', CRON_SECRET: 'feeds-e2e-cron',
    // každá dávka zpracuje jedinou položku → test ověří i navazování dávek (na Vercelu dávka trvá až 30 s)
    FEED_BATCH_MS: '1',
    RESEND_API_KEY: 'test-key', RESEND_API_URL: `http://127.0.0.1:${resend.address().port}`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
api.stdout.on('data', (d) => (log += d));
api.stderr.on('data', (d) => (log += d));

let cookie = '';
const call = async (path, method = 'GET', body) => {
  const r = await fetch(base + path, { method, headers: { cookie, origin: webOrigin, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
};
const checks = [];
const check = async (name, fn) => {
  try { await fn(); checks.push(`ok   ${name}`); } catch (e) { checks.push(`FAIL ${name}: ${e.message}`); }
};
/** Synchronizace jako web: dávky, dokud není hotovo */
let batches = 0;
const syncAll = async (feedId) => {
  batches = 0;
  for (let i = 0; i < 20; i++) {
    batches++;
    const r = await call(`/admin/feeds/${feedId}/sync`, 'POST', {});
    assert.equal(r.status, 201, JSON.stringify(r.body));
    if (r.body.done) return r.body.run;
  }
  throw new Error('synchronizace neskončila');
};
/** Pravidelné úlohy jako Vercel Cron (zámek jobs:tick v Redisu se mezi voláními uvolní, jinak by druhé volání nic neudělalo) */
const runTick = async () => {
  if (process.env.REDIS_URL) {
    const Redis = require('ioredis');
    const r = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    await r.connect().then(() => r.del('jobs:tick')).catch(() => undefined).finally(() => r.disconnect());
  }
  return fetch(`${base}/jobs/tick`, { headers: { authorization: 'Bearer feeds-e2e-cron' } });
};
const listingOf = (feedItemId) => prisma.listing.findFirst({ where: { feedItemId, feed: { user: { email: PARTNER_EMAIL } } }, include: { images: { orderBy: { position: 'asc' } }, category: { include: { parent: true } }, user: true } });

async function cleanup() {
  const user = await prisma.user.findUnique({ where: { email: PARTNER_EMAIL } });
  if (!user) return;
  const ls = await prisma.listing.findMany({ where: { userId: user.id }, select: { id: true } });
  await prisma.listingImage.deleteMany({ where: { listingId: { in: ls.map((l) => l.id) } } });
  await prisma.listing.deleteMany({ where: { userId: user.id } });
  await prisma.partnerFeed.deleteMany({ where: { userId: user.id } });
  await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

let feedId;
try {
  await cleanup();
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (api.exitCode !== null) throw new Error(`API skončilo s kódem ${api.exitCode}`);
    try { if ((await fetch(`${base}/health`)).ok) break; } catch {}
    if (Date.now() > deadline) throw new Error('API nenaběhlo do 30 s');
    await new Promise((r) => setTimeout(r, 500));
  }
  const login = await call('/auth/login', 'POST', { email: 'admin@dejinzerat.cz', password: process.env.ADMIN_PASSWORD ?? 'Admin12345' });
  assert.equal(login.status, 201, `přihlášení admina: ${login.status}`);
  const adminCookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  cookie = adminCookie;

  await check('bez přihlášení nejde nic', async () => {
    const r = await fetch(`${base}/admin/feeds`, { headers: { origin: webOrigin } });
    assert.equal(r.status, 401);
  });

  await check('náhled před založením: formát, pole, kategorie, vše ke schválení', async () => {
    // stejné tělo, jaké posílá administrace (ruční přiřazení jen u některých polí)
    const r = await call('/admin/feeds/preview', 'POST', { url: feedUrl, format: 'auto', fieldMap: { gearbox: [] }, categoryMap: {}, defaultCategoryId: null, defaultCity: 'Brno', defaultZip: null, requireApproval: true, intervalHours: 24, maxItems: 1000, active: true });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual(r.body.fieldMap.gearbox, []);
    assert.equal(r.body.format, 'generic');
    assert.equal(r.body.total, 3);
    assert.deepEqual(r.body.fieldMap.id, ['@id']);
    assert.deepEqual(r.body.fieldMap.images, ['fotky/foto/@url']);
    assert.deepEqual({ new: r.body.counts.new, review: r.body.counts.review }, { new: 3, review: 3 });
    const transit = r.body.items.find((i) => i.id === 'E2E-3');
    assert.equal(transit.newCategory, 'Auto-moto › Užitkové vozy');
    assert.equal(transit.title, 'Ford Transit Custom');
    const octavia = r.body.items.find((i) => i.id === 'E2E-1');
    assert.equal(octavia.attributes.brand, 'Škoda');
    assert.equal(octavia.attributes.mileage, 125000);
    assert.equal(octavia.url, `http://127.0.0.1:${partner.address().port}/nabidka/E2E-1`);
  });

  await check('špatná adresa a nesmysl ve feedu ohlásí srozumitelnou chybu', async () => {
    assert.equal((await call('/admin/feeds/preview', 'POST', { url: 'ftp://x.cz/feed.xml' })).status, 400);
    broken = true;
    const r = await call('/admin/feeds/preview', 'POST', { url: feedUrl });
    broken = false;
    assert.equal(r.status, 400);
    assert.match(r.body.message, /XML/);
  });

  await check('založení partnera s novým firemním účtem (bez hesla)', async () => {
    const bad = await call('/admin/feeds', 'POST', { name: 'Autobazar E2E', url: feedUrl, account: { mode: 'existing', email: PARTNER_EMAIL } });
    assert.equal(bad.status, 400);
    const r = await call('/admin/feeds', 'POST', {
      name: 'Autobazar E2E', url: feedUrl, defaultCity: 'Brno', account: { mode: 'new', email: PARTNER_EMAIL, companyName: 'Autobazar E2E s.r.o.', companyId: '27082440', phone: '777 123 456' },
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    feedId = r.body.id;
    const u = await prisma.user.findUnique({ where: { email: PARTNER_EMAIL } });
    assert.equal(u.isBusiness, true);
    assert.equal(u.companyName, 'Autobazar E2E s.r.o.');
    assert.equal(u.passwordHash, null);
    assert.equal(u.phone, '+420777123456');
    const dup = await call('/admin/feeds', 'POST', { name: 'X', url: feedUrl, account: { mode: 'new', email: PARTNER_EMAIL, companyName: 'X s.r.o.' } });
    assert.equal(dup.status, 400);
  });

  await check('synchronizace založí inzeráty s fotkami a parametry – čekají na schválení', async () => {
    const run = await syncAll(feedId);
    assert.equal(run.status, 'ok', JSON.stringify(run));
    assert.equal(run.created, 3);
    assert.equal(batches, 3, `dávek: ${batches}`);
    const o = await listingOf('E2E-1');
    assert.equal(o.status, 'PENDING');
    assert.equal(o.title, 'Škoda Octavia Combi 2.0 TDI');
    assert.equal(o.price, 289000);
    assert.equal(o.city, 'Brno');
    assert.equal(o.description, 'Servisní knížka, nehavarováno.');
    assert.equal(`${o.category.parent.name} › ${o.category.name}`, 'Auto-moto › Osobní automobily');
    assert.deepEqual(o.attributes, { brand: 'Škoda', year: 2018, mileage: 125000, fuel: 'Nafta' });
    assert.equal(o.images.length, 2);
    assert.ok(o.images[0].url.includes(`feeds/${feedId}/`));
    assert.equal(o.user.email, PARTNER_EMAIL);
    assert.ok(o.sourceUrl.endsWith('/nabidka/E2E-1'));
    assert.equal(imageHits, 3);
    // čekající inzerát veřejnost nevidí
    cookie = '';
    assert.equal((await call(`/listings/${o.id}`)).status, 404);
    cookie = adminCookie;
  });

  await check('schválení čekajících: inzeráty jsou veřejné, s odkazem na web partnera', async () => {
    const r = await call(`/admin/feeds/${feedId}/approve-pending`, 'POST');
    assert.equal(r.body.approved, 3);
    const o = await listingOf('E2E-1');
    cookie = '';
    const d = await call(`/listings/${o.id}`);
    cookie = adminCookie;
    assert.equal(d.status, 200);
    assert.equal(d.body.status, 'ACTIVE');
    assert.ok(d.body.sourceUrl.endsWith('/nabidka/E2E-1'));
    assert.equal(d.body.feedHash, undefined);
    assert.equal(d.body.seller.name, 'Autobazar E2E s.r.o.');
  });

  await check('opakovaná synchronizace nic nezdvojí ani znovu nestahuje fotky', async () => {
    const before = imageHits;
    const run = await syncAll(feedId);
    assert.equal(run.created + run.updated, 0, JSON.stringify(run));
    assert.equal(run.unchanged, 3);
    assert.equal(imageHits, before);
    assert.equal(await prisma.listing.count({ where: { feedId } }), 3);
    const prev = await call('/admin/feeds/preview', 'POST', { url: feedUrl, feedId });
    assert.equal(prev.body.counts.unchanged, 3);
  });

  await check('změna ve feedu (cena, fotky) se přenese, schválený inzerát zůstane zveřejněný', async () => {
    cars[0] = { ...cars[0], price: '279000', photos: ['1a', '1c', '1d'] };
    const run = await syncAll(feedId);
    assert.equal(run.updated, 1, JSON.stringify(run));
    const o = await listingOf('E2E-1');
    assert.equal(o.price, 279000);
    assert.equal(o.status, 'ACTIVE');
    assert.equal(o.images.length, 3);
  });

  await check('úpravu moderátorem synchronizace nepřepíše', async () => {
    const y = await listingOf('E2E-2');
    await prisma.listing.update({ where: { id: y.id }, data: { title: 'Toyota Yaris – upraveno moderátorem' } });
    cars[1] = { ...cars[1], price: '319000' };
    const run = await syncAll(feedId);
    assert.equal(run.skipped, 1, JSON.stringify(run));
    const after = await listingOf('E2E-2');
    assert.equal(after.title, 'Toyota Yaris – upraveno moderátorem');
    assert.equal(after.price, 329900);
  });

  await check('rozbitý feed: chyba, nic se nestáhne', async () => {
    broken = true;
    const run = await syncAll(feedId);
    broken = false;
    assert.equal(run.status, 'error');
    assert.match(run.message, /XML/);
    assert.equal(await prisma.listing.count({ where: { feedId, status: 'ACTIVE' } }), 3);
    const f = await prisma.partnerFeed.findUnique({ where: { id: feedId } });
    assert.equal(f.lastStatus, 'error');
  });

  await check('nabídka, která z feedu zmizí, se stáhne; když se vrátí, znovu se zveřejní', async () => {
    const transit = cars[2];
    cars = cars.slice(0, 2);
    let run = await syncAll(feedId);
    assert.equal(run.removed, 1, JSON.stringify(run));
    assert.equal((await listingOf('E2E-3')).status, 'EXPIRED');
    cars.push(transit);
    run = await syncAll(feedId);
    assert.equal(run.updated, 1, JSON.stringify(run));
    const back = await listingOf('E2E-3');
    assert.equal(back.status, 'ACTIVE');
    assert.equal(await prisma.listing.count({ where: { feedId } }), 3);
  });

  await check('bez ručního schvalování: běžná nabídka hned zveřejněná, podezřelá čeká', async () => {
    await call(`/admin/feeds/${feedId}`, 'PATCH', { requireApproval: false });
    cars.push({ id: 'E2E-4', brand: 'Kia', model: 'Ceed', year: '2021', km: '30000', fuel: 'benzín', price: '399000', photos: [] });
    cars.push({ id: 'E2E-5', brand: 'BMW', model: '320d', year: '2017', km: '150000', fuel: 'nafta', price: '1', photos: [], text: 'Rychlé půjčky bez registru, peníze ihned, volejte na WhatsApp +44 7700 900123, platba předem Western Union.' });
    const run = await syncAll(feedId);
    assert.equal(run.created, 2, JSON.stringify(run));
    assert.equal((await listingOf('E2E-4')).status, 'ACTIVE');
    assert.equal((await listingOf('E2E-5')).status, 'PENDING');
  });

  await check('automatická synchronizace (cron) proběhne, až uplyne interval', async () => {
    cars[3] = { ...cars[3], price: '389000' };
    await prisma.partnerFeed.update({ where: { id: feedId }, data: { nextSyncAt: new Date(Date.now() + 3600_000) } });
    const hitsBefore = feedHits;
    const tick = await runTick();
    assert.equal(tick.status, 200);
    assert.equal(feedHits, hitsBefore, 'feed se stahoval před uplynutím intervalu');
    await prisma.partnerFeed.update({ where: { id: feedId }, data: { nextSyncAt: new Date(Date.now() - 1000) } });
    assert.equal((await runTick()).status, 200);
    assert.equal((await listingOf('E2E-4')).price, 389000);
    const f = await prisma.partnerFeed.findUnique({ where: { id: feedId }, include: { runs: { orderBy: { startedAt: 'desc' }, take: 1 } } });
    assert.equal(f.runs[0].trigger, 'schedule');
    assert.ok(f.nextSyncAt > new Date(Date.now() + 20 * 3600_000));
  });

  await check('přehled partnerů a detail s historií', async () => {
    const list = await call('/admin/feeds');
    const me = list.body.find((f) => f.id === feedId);
    assert.equal(me.counts.ACTIVE, 4);
    assert.equal(me.counts.PENDING, 1);
    const d = await call(`/admin/feeds/${feedId}`);
    assert.ok(d.body.runs.length >= 8);
    assert.equal(d.body.user.claimed, false);
    assert.equal(d.body.user.passwordHash, undefined);
  });

  await check('pozvánka partnerovi: odkaz na nastavení hesla', async () => {
    const before = mails.length;
    const r = await call(`/admin/feeds/${feedId}/invite`, 'POST');
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const mine = mails.slice(before).filter((m) => m.to === PARTNER_EMAIL);
    assert.equal(mine.length, 1);
    assert.match(mine[0].html, /obnova-hesla\?token=/);
    assert.ok((await prisma.user.findUnique({ where: { email: PARTNER_EMAIL } })).partnerInvitedAt);
  });

  await check('smazání partnera stáhne jeho inzeráty (zůstanou mu v účtu)', async () => {
    const r = await call(`/admin/feeds/${feedId}`, 'DELETE', { listings: 'expire' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.expired, 5);
    const user = await prisma.user.findUnique({ where: { email: PARTNER_EMAIL } });
    assert.equal(await prisma.listing.count({ where: { userId: user.id, status: 'EXPIRED', feedId: null } }), 5);
  });
} catch (e) {
  checks.push(`FAIL příprava: ${e.message}`);
} finally {
  await cleanup().catch((e) => checks.push(`FAIL úklid: ${e.message}`));
  await prisma.$disconnect();
  api.kill();
  partner.close();
  resend.close();
}

console.log(checks.join('\n'));
if (checks.some((c) => c.startsWith('FAIL'))) {
  console.log('\n--- log API ---\n' + log.slice(-4000));
  process.exit(1);
}
console.log(`\nImport z XML feedů partnerů: ${checks.length} kontrol v pořádku.`);
