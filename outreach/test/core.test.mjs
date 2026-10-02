import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, upsertLead, suppress } from '../lib/db.mjs';
import { buildQuery, parseOverpass } from '../lib/leads.mjs';
import { extractEmails, pickBestEmail, auditHtml } from '../lib/enrich.mjs';
import { render, buildMessage } from '../lib/template.mjs';
import { tick, warmupCap, inSendWindow } from '../lib/scheduler.mjs';

const cfg = {
  publicUrl: 'https://out.example', senderName: 'HK', senderImprint: 'HK Growth · Str. 1 · 12345 Ort', replyTo: '',
  dailyLimit: 1000, warmupStart: 20, warmupGrowth: 1.25, sendDays: [1, 2, 3, 4, 5], sendHours: [8, 17],
  maxFailureRate: 0.05, allowColdEmail: false, timezone: 'Europe/Berlin'
};
const MONDAY_10 = new Date('2026-10-05T08:00:00Z'); // 10:00 Berlin (MESZ)

function fakeAccount(id = 'a@x.de', limit = 150, fail) {
  const sent = [];
  return { id, from: id, dailyLimit: limit, sent, transport: { sendMail: async (m) => { if (fail) throw fail; sent.push(m); } } };
}

function seed(db, basis = 'consent', n = 1) {
  const c = db.prepare("INSERT INTO campaigns (name, subject, body, followup_body, status) VALUES ('t', 'Hallo {{firma}}', 'Text {{problem|kein Problem}}', 'Nachfass', 'running')").run();
  const cid = Number(c.lastInsertRowid);
  for (let i = 0; i < n; i++) {
    const { id } = upsertLead(db, { source: 'osm', source_id: `n/${i}`, name: `Firma ${i}`, email: `info${i}@firma.de`, city: 'Hamburg', basis });
    db.prepare('INSERT INTO sends (campaign_id, lead_id, due_at) VALUES (?, ?, ?)').run(cid, id, '2020-01-01 00:00:00');
  }
  return cid;
}

test('Overpass-Query und Parser', () => {
  const q = buildQuery({ city: 'Ham"burg', categories: ['handwerk'], withoutWebsiteOnly: true });
  assert.match(q, /area\["name"="Ham\\"burg"\]/);
  assert.match(q, /\["craft"\]\["name"\]\[!"website"\]/);
  const leads = parseOverpass({ elements: [
    { type: 'node', id: 1, tags: { name: 'Elektro Meier', craft: 'electrician', 'addr:street': 'Weg', 'addr:housenumber': '3', email: 'info@meier.de', website: 'meier.de' } },
    { type: 'way', id: 2, tags: { shop: 'hairdresser' } }
  ] }, 'Hamburg');
  assert.equal(leads.length, 1);
  assert.deepEqual([leads[0].category, leads[0].street, leads[0].website, leads[0].city], ['handwerk', 'Weg 3', 'http://meier.de/', 'Hamburg']);
});

test('E-Mail-Extraktion inkl. (at)-Verschleierung', () => {
  const html = '<a href="mailto:Info@Meier.de">x</a> kontakt (at) meier (punkt) de <img src="logo@2x.png"> sentry@ingest.io';
  const e = extractEmails(html);
  assert.ok(e.includes('info@meier.de'));
  assert.ok(e.includes('kontakt@meier.de'));
  assert.ok(!e.some((x) => x.includes('2x') || x.includes('sentry')));
  assert.equal(pickBestEmail(['chef@gmail.com', 'kontakt@meier.de'], 'https://www.meier.de'), 'kontakt@meier.de');
});

test('Website-Audit findet typische Probleme', () => {
  const r = auditHtml('<html><title>Meier</title><footer>© 2014 Meier</footer></html>', { url: 'http://meier.de', finalUrl: 'http://meier.de', ms: 4200 });
  assert.ok(r.issues.some((i) => i.includes('HTTPS')));
  assert.ok(r.issues.some((i) => i.includes('Smartphones')));
  assert.ok(r.issues.some((i) => i.includes('langsam')));
  assert.ok(r.issues.some((i) => i.includes('veraltet')));
  assert.ok(r.score < 50);
});

test('Template mit Fallback, Impressum und Abmelde-Header', () => {
  assert.equal(render('Hi {{firma}}, {{problem|alles gut}}', { firma: 'X', problem: '' }), 'Hi X, alles gut');
  const msg = buildMessage({ campaign: { subject: 'Frage zu {{firma}}', body: 'Text' }, lead: { name: 'Meier', token: 'tok' }, cfg });
  assert.equal(msg.subject, 'Frage zu Meier');
  assert.match(msg.text, /HK Growth · Str\. 1/);
  assert.match(msg.text, /https:\/\/out\.example\/u\/tok/);
  assert.equal(msg.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});

test('Warm-up und Versandfenster', () => {
  assert.equal(warmupCap(cfg, 150, 0), 20);
  assert.equal(warmupCap(cfg, 150, 3), 39);
  assert.equal(warmupCap(cfg, 150, 30), 150);
  assert.ok(inSendWindow(MONDAY_10, cfg));
  assert.ok(!inSendWindow(new Date('2026-10-04T08:00:00Z'), cfg)); // Sonntag
  assert.ok(!inSendWindow(new Date('2026-10-05T19:00:00Z'), cfg)); // 21 Uhr
});

test('Versand: sendet, plant Follow-up, respektiert Warm-up-Limit', async () => {
  const db = openDb(':memory:');
  seed(db, 'consent', 25);
  const acc = fakeAccount();
  const results = [];
  for (let i = 0; i < 25; i++) results.push((await tick(db, cfg, [acc], MONDAY_10)).action);
  assert.equal(acc.sent.length, 20, 'Tag 1 nur 20 Mails (Warm-up)');
  assert.equal(results.at(-1), 'accounts-exhausted');
  assert.match(acc.sent[0].subject, /Hallo Firma 0/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM sends WHERE step = 1').get().n, 20);
});

test('Ohne Rechtsgrundlage wird nicht gemailt (ALLOW_COLD_EMAIL=false)', async () => {
  const db = openDb(':memory:');
  seed(db, 'none', 1);
  const acc = fakeAccount();
  const r = await tick(db, cfg, [acc], MONDAY_10);
  assert.equal(r.action, 'skipped');
  assert.equal(acc.sent.length, 0);
  assert.equal((await tick(db, cfg, [acc], MONDAY_10)).action, 'idle');
});

test('Abgemeldete Adressen werden nie angeschrieben', async () => {
  const db = openDb(':memory:');
  seed(db, 'consent', 1);
  suppress(db, 'INFO0@firma.de', 'unsubscribe');
  const acc = fakeAccount();
  assert.equal((await tick(db, cfg, [acc], MONDAY_10)).action, 'idle');
  assert.equal(acc.sent.length, 0);
});

test('Hard-Bounces werden gesperrt, hohe Fehlerquote pausiert die Kampagne', async () => {
  const db = openDb(':memory:');
  const cid = seed(db, 'consent', 40);
  const err = Object.assign(new Error('550 user unknown'), { responseCode: 550 });
  const acc = fakeAccount('a@x.de', 150, err);
  for (let i = 0; i < 20; i++) await tick(db, cfg, [acc], MONDAY_10);
  for (let i = 0; i < 15; i++) await tick(db, cfg, [{ ...acc, id: 'b@x.de' }], MONDAY_10);
  assert.ok(db.prepare('SELECT COUNT(*) n FROM suppression').get().n >= 30);
  const c = db.prepare('SELECT status, paused_reason FROM campaigns WHERE id = ?').get(cid);
  assert.equal(c.status, 'paused');
  assert.match(c.paused_reason, /Automatisch pausiert/);
});

test('Vorübergehende SMTP-Fehler werden bis zu 3× wiederholt', async () => {
  const db = openDb(':memory:');
  seed(db, 'consent', 1);
  const acc = fakeAccount('a@x.de', 150, Object.assign(new Error('421 try later'), { responseCode: 421 }));
  assert.equal((await tick(db, cfg, [acc], MONDAY_10)).action, 'retry');
  assert.equal((await tick(db, cfg, [acc], MONDAY_10)).action, 'idle', 'erst in 15 Min. wieder dran');
  const later = new Date(MONDAY_10.getTime() + 16 * 60_000);
  assert.equal((await tick(db, cfg, [acc], later)).action, 'retry');
  const evenLater = new Date(later.getTime() + 16 * 60_000);
  assert.equal((await tick(db, cfg, [acc], evenLater)).action, 'failed');
  assert.equal(db.prepare('SELECT attempts FROM sends').get().attempts, 3);
});
