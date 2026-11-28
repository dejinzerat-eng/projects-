// Celý import ze starého webu proti falešnému „starému webu“ a skutečné databázi (po `pnpm seed`):
// náhled, import s fotkami, opakování bez duplicit, změna na starém webu, úprava v novém systému,
// zmizelé inzeráty, přesměrování /produkt?id= a rozeslání pozvánek. Na konci po sobě vše uklidí.
// Spuštění: `pnpm --filter @dej/api legacy:e2e` (GitHub kontrola ho pouští po smoke testu).
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ---------- falešný starý web (SvelteKit __data.json ve formátu devalue) ----------
function flatten(value) {
  const out = [];
  const walk = (v) => {
    const i = out.length;
    out.push(null);
    if (v instanceof Date) out[i] = ['Date', v.toISOString()];
    else if (Array.isArray(v)) out[i] = v.map(walk);
    else if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = walk(x); out[i] = o; }
    else out[i] = v;
    return i;
  };
  walk(value);
  return out;
}
const page = (data) => JSON.stringify({ type: 'data', nodes: [{ type: 'data', data: flatten({}) }, null, { type: 'data', data: flatten(data) }] });

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
const users = {
  9001: { UserId: 9001, Username: 'pepa', FullName: 'Pepa Prodejce', Email: 'pepa.legacy-e2e@example.cz', TelNumber: ' ‪+420 777 111 222', Banned: false, Type: 'User' },
  9002: { UserId: 9002, Username: 'podvodnik', FullName: '', Email: 'demo2@dejinzerat.cz', TelNumber: '', Banned: false, Type: 'User' },
};
let source = [
  { InzeratId: ids[0], InzeratName: 'Škoda Fabia Combi 1.2 TDI', InzeratDescription: '<p>Pěkné auto,&nbsp;STK do 2027.</p><p><br></p><p>Volejte.</p>', ShortDescription: '', DateCreated: new Date('2025-03-01T10:00:00Z'), ImgsPath: '["abc123.webp","def456.webp"]', Price: 57000, Active: true, Approved: true, Status: 'Created', Location: 'Praha', UserId: 9001, CategoryId: 1, SubcategoryId: 113 },
  { InzeratId: ids[1], InzeratName: 'Dárek štěňata rotvajlera k adopci zdarma', InzeratDescription: '<p>Zdarma, jen zaplaťte dopravu.</p>', ShortDescription: '', DateCreated: new Date('2026-10-01T10:00:00Z'), ImgsPath: '[]', Price: 0, Active: true, Approved: true, Status: 'Created', Location: 'Jihomoravský kraj', UserId: 9002, CategoryId: 7, SubcategoryId: 76 },
  { InzeratId: ids[2], InzeratName: 'Zateplíme vám dům', InzeratDescription: '<p>Zateplení fasád, Liberec a okolí.</p>', ShortDescription: '', DateCreated: new Date('2026-05-01T10:00:00Z'), ImgsPath: '["ghi789.webp"]', Price: 1, Active: true, Approved: true, Status: 'Created', Location: 'Liberecký kraj', UserId: 9001, CategoryId: 8, SubcategoryId: 71 },
];
const img = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 16, g: 160, b: 110 } } }).webp().toBuffer();
let imageHits = 0;
const legacy = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/nejnovejsi-inzeraty/__data.json') {
    const n = Number(u.searchParams.get('page') ?? 1);
    res.setHeader('content-type', 'application/json');
    return res.end(page({ inzeraty: source.slice((n - 1) * 15, n * 15), pageCount: Math.max(1, Math.ceil(source.length / 15)) }));
  }
  if (u.pathname === '/produkt/__data.json') {
    const l = source.find((x) => x.InzeratId === u.searchParams.get('id'));
    if (!l) { res.statusCode = 404; return res.end('{}'); }
    res.setHeader('content-type', 'application/json');
    return res.end(page({ inzerat: { ...l, user: { ...users[l.UserId], Password: '' } }, loggedIn: false }));
  }
  if (u.pathname.startsWith('/inzeraty_images/')) { imageHits++; res.setHeader('content-type', 'image/webp'); return res.end(img); }
  res.statusCode = 404; res.end();
});
// falešné API Resend – zachytí odeslané pozvánky
const mails = [];
const resend = createServer((req, res) => {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', () => { mails.push(JSON.parse(body)); res.setHeader('content-type', 'application/json'); res.end('{"id":"test"}'); });
});
await new Promise((ok) => legacy.listen(0, '127.0.0.1', ok));
await new Promise((ok) => resend.listen(0, '127.0.0.1', ok));

// ---------- API ----------
const port = process.env.LEGACY_E2E_PORT ?? '4110';
const base = `http://127.0.0.1:${port}`;
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = spawn(process.execPath, ['dist/main.js'], {
  env: { ...process.env, PORT: port, DISABLE_JOBS: '1', MEILI_URL: '', LEGACY_SOURCE_URL: `http://127.0.0.1:${legacy.address().port}`, RESEND_API_KEY: 'test-key', RESEND_API_URL: `http://127.0.0.1:${resend.address().port}` },
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

async function cleanup() {
  const ls = await prisma.listing.findMany({ where: { legacyId: { in: ids } }, select: { id: true } });
  await prisma.listingImage.deleteMany({ where: { listingId: { in: ls.map((l) => l.id) } } });
  await prisma.listing.deleteMany({ where: { id: { in: ls.map((l) => l.id) } } });
  await prisma.verificationToken.deleteMany({ where: { user: { legacyId: { in: ['dejinzerat:9001', 'dejinzerat:9002'] } } } });
  await prisma.user.deleteMany({ where: { legacyId: 'dejinzerat:9001' } });
  await prisma.user.updateMany({ where: { legacyId: 'dejinzerat:9002' }, data: { legacyId: null, legacyInvitedAt: null } });
}

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
  cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

  await check('bez přihlášení import nejde', async () => {
    const r = await fetch(`${base}/admin/legacy/scan`, { method: 'POST', headers: { origin: webOrigin } });
    assert.equal(r.status, 401);
  });

  await check('náhled ukáže 3 nové inzeráty, 1 ke schválení', async () => {
    const { status, body } = await call('/admin/legacy/scan', 'POST');
    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(body.total, 3);
    assert.equal(body.complete, true);
    assert.deepEqual(body.counts, { new: 3, changed: 0, unchanged: 0, review: 1 });
    assert.equal(body.items.find((i) => i.id === ids[2]).newCategory, 'Služby a řemesla › Řemesla a opravy');
  });

  await check('import vytvoří inzeráty, prodejce a fotky', async () => {
    const { status, body } = await call('/admin/legacy/run', 'POST', { ids });
    assert.equal(status, 201, JSON.stringify(body));
    assert.deepEqual(body.results.map((r) => r.result), ['created', 'created', 'created'], JSON.stringify(body.results));
    assert.deepEqual(body.remaining, []);
    const car = await prisma.listing.findUnique({ where: { legacyId: ids[0] }, include: { images: true, user: true, category: { include: { parent: true } } } });
    assert.equal(car.status, 'ACTIVE');
    assert.equal(car.description, 'Pěkné auto, STK do 2027.\n\nVolejte.');
    assert.equal(car.price, 57000);
    assert.equal(car.city, 'Praha');
    assert.equal(car.region, 'PHA');
    assert.equal(`${car.category.parent.slug}/${car.category.slug}`, 'auto-moto/osobni-automobily');
    assert.equal(car.images.length, 2);
    assert.equal(car.publishedAt.toISOString(), '2025-03-01T10:00:00.000Z');
    assert.ok(car.expiresAt > new Date());
    assert.equal(car.user.email, 'pepa.legacy-e2e@example.cz');
    assert.equal(car.user.passwordHash, null);
    assert.equal(car.user.phone, '+420777111222');
    assert.equal(car.user.phoneVerifiedAt, null);
    const dog = await prisma.listing.findUnique({ where: { legacyId: ids[1] }, include: { user: true } });
    assert.equal(dog.status, 'PENDING');
    assert.equal(dog.price, null);
    assert.equal(dog.priceNegotiable, true);
    // e-mail už má registrovaný účet → inzerát patří jemu, nový účet nevznikne
    assert.equal(dog.user.email, 'demo2@dejinzerat.cz');
    assert.equal(dog.user.legacyId, 'dejinzerat:9002');
    const facade = await prisma.listing.findUnique({ where: { legacyId: ids[2] } });
    assert.equal(facade.price, null);
    assert.equal(facade.city, 'Liberec');
  });

  await check('převzatý inzerát je na webu vidět, podezřelý až po schválení', async () => {
    const { body } = await call(`/legacy/listing/${ids[0]}`);
    cookie = cookie.replace(/dej_session=[^;]*/, '');
    const l = await call(`/listings/${body.id}`);
    assert.equal(l.status, 200);
    assert.equal(l.body.title, 'Škoda Fabia Combi 1.2 TDI');
    const pending = await prisma.listing.findUnique({ where: { legacyId: ids[1] } });
    assert.equal((await call(`/listings/${pending.id}`)).status, 404);
    cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  });

  await check('opakovaný import nic nezdvojí ani znovu nestahuje fotky', async () => {
    const before = imageHits;
    const { body } = await call('/admin/legacy/run', 'POST', { ids });
    assert.deepEqual(body.results.map((r) => r.result), ['unchanged', 'unchanged', 'unchanged']);
    assert.equal(imageHits, before);
    assert.equal(await prisma.listing.count({ where: { legacyId: { in: ids } } }), 3);
    assert.equal(await prisma.listingImage.count({ where: { listing: { legacyId: { in: ids } } } }), 3);
    const scan = await call('/admin/legacy/scan', 'POST');
    assert.deepEqual(scan.body.counts, { new: 0, changed: 0, unchanged: 3, review: 0 });
  });

  await check('změna na starém webu se přenese (i fotky)', async () => {
    source[0] = { ...source[0], Price: 52000, ImgsPath: '["abc123.webp","new000.webp","new111.webp"]', Status: 'Updated' };
    const scan = await call('/admin/legacy/scan', 'POST');
    assert.equal(scan.body.counts.changed, 1);
    const { body } = await call('/admin/legacy/run', 'POST', { ids: [ids[0]] });
    assert.equal(body.results[0].result, 'updated', JSON.stringify(body.results));
    const car = await prisma.listing.findUnique({ where: { legacyId: ids[0] }, include: { images: { orderBy: { position: 'asc' } } } });
    assert.equal(car.price, 52000);
    assert.equal(car.images.length, 3);
  });

  await check('úpravu v novém systému import nepřepíše', async () => {
    await prisma.listing.update({ where: { legacyId: ids[2] }, data: { title: 'Zateplení – upraveno moderátorem' } });
    source[2] = { ...source[2], Price: 5000 };
    const { body } = await call('/admin/legacy/run', 'POST', { ids: [ids[2]] });
    assert.equal(body.results[0].result, 'edited');
    const l = await prisma.listing.findUnique({ where: { legacyId: ids[2] } });
    assert.equal(l.title, 'Zateplení – upraveno moderátorem');
    assert.equal(l.price, null);
  });

  await check('inzerát smazaný na starém webu: náhled ho ukáže a lze ho stáhnout', async () => {
    source = source.filter((l) => l.InzeratId !== ids[2]);
    const scan = await call('/admin/legacy/scan', 'POST');
    assert.deepEqual(scan.body.missing.map((m) => m.id).filter((id) => ids.includes(id)), [ids[2]]);
    const r = await call('/admin/legacy/archive-missing', 'POST', { ids: [ids[2]] });
    assert.equal(r.body.archived, 1);
    assert.equal((await prisma.listing.findUnique({ where: { legacyId: ids[2] } })).status, 'EXPIRED');
    const run = await call('/admin/legacy/run', 'POST', { ids: [ids[2]] });
    assert.equal(run.body.results[0].result, 'gone');
  });

  await check('stará adresa /produkt?id= najde nový inzerát', async () => {
    const r = await call(`/legacy/listing/${ids[0]}`);
    assert.equal(r.status, 200);
    assert.ok(r.body.id && r.body.slug.startsWith('skoda-fabia'));
    assert.equal((await call('/legacy/listing/44444444-4444-4444-8444-444444444444')).status, 404);
    assert.equal((await call('/legacy/listing/nesmysl')).status, 404);
  });

  await check('pozvánky: jen převzaté účty bez hesla, odkaz na nastavení hesla, podruhé už ne', async () => {
    const st = await call('/admin/legacy/invites');
    assert.equal(st.body.mailReady, true);
    assert.equal((await call('/admin/legacy/invites', 'POST', {})).status, 400);
    const sentBefore = mails.length;
    const r = await call('/admin/legacy/invites', 'POST', { confirm: true });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const mine = mails.slice(sentBefore).filter((m) => m.to === 'pepa.legacy-e2e@example.cz');
    assert.equal(mine.length, 1);
    assert.match(mine[0].html, /obnova-hesla\?token=/);
    assert.doesNotMatch(mine[0].html, /heslo je:/i);
    // demo2 už má heslo – pozvánku nedostane
    assert.ok(!mails.slice(sentBefore).some((m) => m.to === 'demo2@dejinzerat.cz'));
    const again = await call('/admin/legacy/invites', 'POST', { confirm: true });
    assert.ok(!mails.slice(sentBefore + r.body.sent).some((m) => m.to === 'pepa.legacy-e2e@example.cz'), 'pozvánka odešla dvakrát');
    assert.equal(again.body.remaining, 0);
  });
} catch (e) {
  checks.push(`FAIL příprava: ${e.message}`);
} finally {
  await cleanup().catch((e) => checks.push(`FAIL úklid: ${e.message}`));
  await prisma.$disconnect();
  api.kill();
  legacy.close();
  resend.close();
}

console.log(checks.join('\n'));
if (checks.some((c) => c.startsWith('FAIL'))) {
  console.log('\n--- log API ---\n' + log.slice(-4000));
  process.exit(1);
}
console.log(`\nImport ze starého webu: ${checks.length} kontrol v pořádku.`);
