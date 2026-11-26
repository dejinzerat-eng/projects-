// Vložení inzerátu bez registrace – celý průběh proti skutečné databázi (po `pnpm seed`) a falešnému Resend:
// fotka bez přihlášení → odeslání s e-mailem → účet + koncept → e-mail s odkazem → potvrzení (ověří, přihlásí,
// zveřejní) → nastavení hesla. Dále existující účet, limity, chybná kategorie a převzetí fotek po přihlášení.
// Spuštění: `pnpm --filter @dej/api guest:e2e` (GitHub kontrola ho pouští po smoke testu). Na konci vše uklidí.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const mails = [];
const resend = createServer((req, res) => {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', () => { mails.push(JSON.parse(body)); res.setHeader('content-type', 'application/json'); res.end('{"id":"test"}'); });
});
await new Promise((ok) => resend.listen(0, '127.0.0.1', ok));

const port = process.env.GUEST_E2E_PORT ?? '4120';
const base = `http://127.0.0.1:${port}`;
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = spawn(process.execPath, ['dist/main.js'], {
  env: { ...process.env, PORT: port, DISABLE_JOBS: '1', MEILI_URL: '', TURNSTILE_SECRET: '', TURNSTILE_SITE_KEY: '', RESEND_API_KEY: 'test-key', RESEND_API_URL: `http://127.0.0.1:${resend.address().port}` },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
api.stdout.on('data', (d) => (log += d));
api.stderr.on('data', (d) => (log += d));

const checks = [];
const check = async (name, fn) => {
  try { await fn(); checks.push(`ok   ${name}`); } catch (e) { checks.push(`FAIL ${name}: ${e.message}`); }
};
const RUN = Date.now().toString(36);
const mail = (n) => `guest-e2e-${RUN}-${n}@example.cz`;
let ipSeq = 10;
const ipNet = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
/** Každý krok z jiné IP (limity požadavků na IP by jinak zastavily test samy; limity v Redisu přežijí i další běh). */
const freshIp = () => `${ipNet}.${ipSeq++}`;
const cookieOf = (headers, name) => headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith(`${name}=`));
async function call(path, method = 'GET', body, { cookie = '', ip = freshIp() } = {}) {
  const r = await fetch(base + path, { method, headers: { cookie, origin: webOrigin, 'x-forwarded-for': ip, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
}
const photo = await sharp({ create: { width: 900, height: 700, channels: 3, background: { r: 200, g: 60, b: 40 } } })
  .composite([{ input: Buffer.from('<svg width="900" height="700"><circle cx="300" cy="250" r="160" fill="#fff"/></svg>'), top: 0, left: 0 }]).jpeg().toBuffer();
async function upload(cookie = '') {
  const fd = new FormData();
  fd.append('file', new Blob([photo], { type: 'image/jpeg' }), 'kolo.jpg');
  const r = await fetch(`${base}/media/image`, { method: 'POST', headers: { cookie, origin: webOrigin, 'x-forwarded-for': freshIp() }, body: fd });
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
}
const listing = (extra = {}) => ({
  title: `Reproduktory Bose ${RUN}`, description: 'Prodám reproduktory, plně funkční, jen osobní předání.', price: 2500, categorySlug: 'elektronika', subSlug: 'audio',
  city: 'Brno', offerType: 'SELL', condition: 'USED', ...extra,
});
const tokenFrom = (m) => /potvrzeni-inzeratu\?token=([A-Za-z0-9_-]+)/.exec(m.html)?.[1];

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: `guest-e2e-${RUN}-` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const ls = await prisma.listing.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  await prisma.listingImage.deleteMany({ where: { OR: [{ listingId: { in: ls.map((l) => l.id) } }, { ownerId: { in: ids } }, { url: { contains: 'guest-e2e-never' } }] } });
  await prisma.listing.deleteMany({ where: { id: { in: ls.map((l) => l.id) } } });
  for (const m of ['verificationToken', 'refreshToken', 'notification']) await prisma[m].deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

try {
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (api.exitCode !== null) throw new Error(`API skončilo s kódem ${api.exitCode}`);
    try { if ((await fetch(`${base}/health`)).ok) break; } catch {}
    if (Date.now() > deadline) throw new Error('API nenaběhlo do 30 s');
    await new Promise((r) => setTimeout(r, 500));
  }

  let guest = '', imageId = '', token = '', listingId = '', session = '';

  await check('fotka jde nahrát bez přihlášení a patří prohlížeči', async () => {
    const r = await upload();
    assert.equal(r.status, 201, JSON.stringify(r.body));
    guest = cookieOf(r.headers, 'dej_guest');
    assert.ok(guest, 'chybí cookie dej_guest');
    imageId = r.body.id;
    const img = await prisma.listingImage.findUnique({ where: { id: imageId } });
    assert.match(img.ownerId, /^guest:[0-9a-f]{64}$/);
    // druhá fotka ze stejného prohlížeče dostane stejného vlastníka a žádnou novou cookie
    const again = await upload(guest);
    assert.equal(again.status, 201);
    assert.equal(cookieOf(again.headers, 'dej_guest'), undefined);
    assert.equal((await prisma.listingImage.findUnique({ where: { id: again.body.id } })).ownerId, img.ownerId);
  });

  await check('bez souhlasu s podmínkami nebo s chybným e-mailem se nic neuloží', async () => {
    const a = await call('/listings/guest', 'POST', { ...listing(), email: mail(1) }, { cookie: guest });
    assert.equal(a.status, 400);
    const b = await call('/listings/guest', 'POST', { ...listing(), email: 'neni-email', terms: true }, { cookie: guest });
    assert.equal(b.status, 400);
    assert.equal(await prisma.user.count({ where: { email: mail(1) } }), 0);
  });

  await check('neplatná kategorie → chyba a žádný účet', async () => {
    const r = await call('/listings/guest', 'POST', { ...listing({ subSlug: 'neexistuje' }), email: mail(1), terms: true }, { cookie: guest });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.equal(r.body.field, 'subSlug');
    assert.equal(await prisma.user.count({ where: { email: mail(1) } }), 0);
  });

  await check('odeslání s e-mailem: účet bez hesla, koncept s fotkou, e-mail s odkazem', async () => {
    const sent = mails.length;
    const r = await call('/listings/guest', 'POST', { ...listing(), imageIds: [imageId], email: mail(1).toUpperCase(), name: 'Jan Tester', terms: true }, { cookie: guest });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.email, mail(1));
    listingId = r.body.listingId;
    const u = await prisma.user.findUnique({ where: { email: mail(1) } });
    assert.ok(u, 'účet nevznikl');
    assert.equal(u.name, 'Jan Tester');
    assert.equal(u.passwordHash, null);
    assert.equal(u.emailVerifiedAt, null);
    assert.ok(u.termsAcceptedAt && u.termsVersion, 'chybí souhlas s podmínkami');
    const l = await prisma.listing.findUnique({ where: { id: listingId }, include: { images: true } });
    assert.equal(l.status, 'DRAFT');
    assert.equal(l.userId, u.id);
    assert.deepEqual(l.images.map((i) => [i.id, i.ownerId]), [[imageId, u.id]]);
    const m = mails.slice(sent).filter((x) => x.to === mail(1));
    assert.equal(m.length, 1);
    assert.match(m[0].subject, /Potvrďte e-mail a zveřejněte inzerát/);
    token = tokenFrom(m[0]);
    assert.ok(token, 'v e-mailu chybí odkaz');
  });

  await check('nepotvrzený inzerát není veřejný ani ve vyhledávání', async () => {
    assert.equal((await call(`/listings/${listingId}`)).status, 404);
    const s = await call(`/search?q=${encodeURIComponent(`Bose ${RUN}`)}`);
    assert.ok(!s.body.hits.some((h) => h.id === listingId));
  });

  await check('potvrzení odkazem ověří e-mail, přihlásí a zveřejní inzerát', async () => {
    const r = await call('/listings/guest/confirm', 'POST', { token });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.listing.id, listingId);
    assert.equal(r.body.listing.status, 'ACTIVE');
    assert.equal(r.body.hasPassword, false);
    assert.equal(r.body.publishError, undefined);
    session = cookieOf(r.headers, 'dej_session');
    assert.ok(session, 'chybí přihlášení');
    const me = await call('/auth/me', 'GET', undefined, { cookie: session });
    assert.equal(me.body.user.email, mail(1));
    assert.ok(me.body.user.emailVerifiedAt);
    assert.equal((await call(`/listings/${listingId}`)).status, 200);
  });

  await check('odkaz platí jen jednou', async () => {
    assert.equal((await call('/listings/guest/confirm', 'POST', { token })).status, 400);
    assert.equal((await call('/listings/guest/confirm', 'POST', { token: 'x'.repeat(32) })).status, 400);
  });

  await check('po potvrzení si nastaví heslo a přihlásí se jím', async () => {
    const r = await call('/auth/password/change', 'POST', { current: '', password: 'NoveHeslo123' }, { cookie: session });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const login = await call('/auth/login', 'POST', { email: mail(1), password: 'NoveHeslo123' });
    assert.equal(login.status, 201, JSON.stringify(login.body));
  });

  await check('e-mail s existujícím účtem → přihlášení, nic se nezaloží', async () => {
    for (const email of [mail(1), 'demo1@dejinzerat.cz']) {
      const before = await prisma.listing.count();
      const r = await call('/listings/guest', 'POST', { ...listing({ title: `Jiný inzerát ${RUN}` }), email, terms: true });
      assert.equal(r.status, 409, JSON.stringify(r.body));
      assert.equal(r.body.code, 'ACCOUNT_EXISTS');
      assert.equal(await prisma.listing.count(), before);
    }
  });

  await check('fotky nahrané před přihlášením se po přihlášení převedou na účet', async () => {
    const up = await upload();
    const g = cookieOf(up.headers, 'dej_guest');
    const r = await call('/listings', 'POST', { ...listing({ title: `Sluchátka Sony ${RUN}`, description: 'Sluchátka Sony WH-1000XM4, krabice a účtenka.' }), imageIds: [up.body.id] }, { cookie: `${session}; ${g}` });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const l = await prisma.listing.findUnique({ where: { id: r.body.id }, include: { images: true } });
    assert.deepEqual(l.images.map((i) => i.id), [up.body.id]);
    // cizí prohlížeč (bez cookie) si cizí fotku nepřivlastní
    const up2 = await upload();
    const r2 = await call('/listings', 'POST', { ...listing({ title: `Gramofon Technics ${RUN}`, description: 'Gramofon Technics SL-1200, servisovaný.' }), imageIds: [up2.body.id] }, { cookie: session });
    const l2 = await prisma.listing.findUnique({ where: { id: r2.body.id }, include: { images: true } });
    assert.equal(l2.images.length, 0);
    assert.match((await prisma.listingImage.findUnique({ where: { id: up2.body.id } })).ownerId, /^guest:/);
    await prisma.listingImage.update({ where: { id: up2.body.id }, data: { url: 'guest-e2e-never' } }); // úklid
  });

  await check('opakované odeslání na nepotvrzený e-mail: každý inzerát má svůj odkaz, pak limit', async () => {
    const tokens = [];
    for (let i = 0; i < 3; i++) {
      const sent = mails.length;
      const r = await call('/listings/guest', 'POST', { ...listing({ title: `Zesilovač Yamaha ${i} ${RUN}`, description: `Zesilovač Yamaha A-S${i}01, plně funkční.` }), email: mail(2), terms: true });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      tokens.push(tokenFrom(mails.slice(sent).find((m) => m.to === mail(2))));
    }
    assert.equal(await prisma.user.count({ where: { email: mail(2) } }), 1);
    const over = await call('/listings/guest', 'POST', { ...listing({ title: `Zesilovač Yamaha 9 ${RUN}` }), email: mail(2), terms: true });
    assert.equal(over.status, 429, JSON.stringify(over.body));
    // starší odkaz platí dál a zveřejní svůj inzerát
    const c = await call('/listings/guest/confirm', 'POST', { token: tokens[0] });
    assert.equal(c.status, 201, JSON.stringify(c.body));
    assert.match(c.body.listing.status, /ACTIVE|PENDING/);
    // po potvrzení je to skutečný účet → další inzerát bez přihlášení už nejde
    const after = await call('/listings/guest', 'POST', { ...listing({ title: `Zesilovač Yamaha 10 ${RUN}` }), email: mail(2), terms: true });
    assert.equal(after.status, 409);
  });

  await check('limit inzerátů bez přihlášení z jedné IP adresy', async () => {
    const ip = freshIp();
    const codes = [];
    for (let i = 0; i < 6; i++) {
      // limit 5 požadavků za minutu na adresu (Throttle) i 5 inzerátů za hodinu (Redis) – oba vrací 429
      const r = await call('/listings/guest', 'POST', { ...listing({ title: `Rádio Tesla ${i} ${RUN}`, description: `Rádio Tesla ${i}, hraje, původní stav.` }), email: mail(10 + i), terms: true }, { ip });
      codes.push(r.status);
    }
    assert.deepEqual(codes.slice(0, 5), [201, 201, 201, 201, 201]);
    assert.equal(codes[5], 429);
  });
} catch (e) {
  checks.push(`FAIL příprava: ${e.message}`);
} finally {
  await cleanup().catch((e) => checks.push(`FAIL úklid: ${e.message}`));
  await prisma.$disconnect();
  api.kill();
  resend.close();
}

console.log(checks.join('\n'));
if (checks.some((c) => c.startsWith('FAIL'))) {
  console.log('\n--- log API ---\n' + log.slice(-4000));
  process.exit(1);
}
console.log(`\nInzerát bez registrace: ${checks.length} kontrol v pořádku.`);
