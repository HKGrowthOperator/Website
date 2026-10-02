import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../lib/db.mjs';
import { createApp } from '../server.mjs';

const cfg = { publicUrl: 'http://x', adminUser: 'admin', adminPass: 'pw', senderName: 'HK', senderImprint: 'Impressum', allowColdEmail: false,
  dryRun: true, dailyLimit: 100, warmupStart: 20, warmupGrowth: 1.25, sendDays: [1], sendHours: [8, 17], timezone: 'Europe/Berlin' };
const auth = { Authorization: `Basic ${Buffer.from('admin:pw').toString('base64')}`, 'Content-Type': 'application/json' };

async function withServer(fn) {
  const db = openDb(':memory:');
  const deps = { findLeads: async () => [
    { source: 'osm', source_id: 'n/1', name: 'Bäckerei Ohne', city: 'Kiel', phone: '0431 1' },
    { source: 'osm', source_id: 'n/2', name: 'Friseur Mail', city: 'Kiel', email: 'info@friseur.de', website: 'http://friseur.de/' }
  ] };
  const server = createApp(cfg, db, [], deps).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base, db); } finally { server.close(); }
}

test('API: Login, Lead-Suche, Kampagne, Basis-Sperre, Abmeldung', () => withServer(async (base, db) => {
  assert.equal((await fetch(`${base}/api/meta`)).status, 401);

  const s = await (await fetch(`${base}/api/leads/search`, { method: 'POST', headers: auth, body: JSON.stringify({ city: 'Kiel' }) })).json();
  assert.deepEqual([s.found, s.created, s.withEmail, s.withoutWebsite], [2, 2, 1, 1]);

  const c = await (await fetch(`${base}/api/campaigns`, { method: 'POST', headers: auth, body: JSON.stringify({ name: 'K', subject: 'Hi {{firma}}', body: 'B' }) })).json();
  let q = await (await fetch(`${base}/api/campaigns/${c.id}/enqueue`, { method: 'POST', headers: auth, body: '{}' })).json();
  assert.equal(q.queued, 0, 'kalter Lead ohne Basis wird nicht eingereiht');

  const lead = db.prepare("SELECT * FROM leads WHERE email = 'info@friseur.de'").get();
  await fetch(`${base}/api/leads/${lead.id}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ basis: 'inquiry' }) });
  q = await (await fetch(`${base}/api/campaigns/${c.id}/enqueue`, { method: 'POST', headers: auth, body: '{}' })).json();
  assert.equal(q.queued, 1);

  const csv = await (await fetch(`${base}/api/leads/export.csv?hasEmail=0`, { headers: auth })).text();
  assert.match(csv, /Bäckerei Ohne/);
  assert.doesNotMatch(csv, /Friseur Mail/);

  const un = await fetch(`${base}/u/${lead.token}`, { method: 'POST' });
  assert.equal(un.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM suppression').get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sends WHERE status = 'queued'").get().n, 0);
}));

test('API: Telefon-Workflow – Infos schicken macht Lead mailbar und plant Mail ein', () => withServer(async (base, db) => {
  await fetch(`${base}/api/leads/search`, { method: 'POST', headers: auth, body: JSON.stringify({ city: 'Kiel' }) });
  const c = await (await fetch(`${base}/api/campaigns`, { method: 'POST', headers: auth, body: JSON.stringify({ name: 'K', subject: 'S', body: 'B' }) })).json();
  const queue = await (await fetch(`${base}/api/calls/queue`, { headers: auth })).json();
  assert.equal(queue.rows.length, 1, 'nur Leads mit Telefonnummer');
  const lead = queue.rows[0];

  let r = await fetch(`${base}/api/leads/${lead.id}/call`, { method: 'POST', headers: auth, body: JSON.stringify({ outcome: 'send_info' }) });
  assert.equal(r.status, 400, 'ohne E-Mail nicht möglich');

  r = await (await fetch(`${base}/api/leads/${lead.id}/call`, { method: 'POST', headers: auth,
    body: JSON.stringify({ outcome: 'send_info', email: 'Chef@Baeckerei.de', note: 'will Beispiele', campaignId: c.id }) })).json();
  assert.equal(r.queued, true);
  assert.equal(r.lead.basis, 'inquiry');
  assert.equal(r.lead.email, 'chef@baeckerei.de');
  assert.match(r.lead.notes, /will Beispiele/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM calls').get().n, 1);
  assert.equal((await (await fetch(`${base}/api/calls/queue`, { headers: auth })).json()).rows.length, 0, 'heute nicht nochmal anrufen');
}));

test('API: Rückruf erscheint erst wieder, wenn fällig', () => withServer(async (base, db) => {
  await fetch(`${base}/api/leads/search`, { method: 'POST', headers: auth, body: JSON.stringify({ city: 'Kiel' }) });
  const lead = db.prepare('SELECT id FROM leads WHERE phone IS NOT NULL').get();
  const later = new Date(Date.now() + 3 * 86400_000).toISOString();
  await fetch(`${base}/api/leads/${lead.id}/call`, { method: 'POST', headers: auth, body: JSON.stringify({ outcome: 'callback', callbackAt: later }) });
  assert.equal((await (await fetch(`${base}/api/calls/queue`, { headers: auth })).json()).rows.length, 0);
  db.prepare("UPDATE leads SET callback_at = datetime('now', '-1 minute') WHERE id = ?").run(lead.id);
  const q = await (await fetch(`${base}/api/calls/queue`, { headers: auth })).json();
  assert.equal(q.rows.length, 1);
  assert.equal(q.callbacksDue, 1);
  assert.equal(db.prepare('SELECT call_attempts FROM leads WHERE id = ?').get(lead.id).call_attempts, 0, 'Rückruf zählt nicht als Fehlversuch');
}));
