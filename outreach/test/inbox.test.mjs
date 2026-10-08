import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simpleParser } from 'mailparser';
import { openDb, upsertLead, isSuppressed } from '../lib/db.mjs';
import { classifyMessage, processMessage } from '../lib/inbox.mjs';

const raw = (lines) => simpleParser(Buffer.from(lines.join('\r\n')));

function setup() {
  const db = openDb(':memory:');
  const c = Number(db.prepare("INSERT INTO campaigns (name, subject, body, status) VALUES ('t','s','b','running')").run().lastInsertRowid);
  const { id } = upsertLead(db, { source: 'osm', source_id: 'n/1', name: 'Meier', email: 'info@meier.de', basis: 'consent' });
  db.prepare("INSERT INTO sends (campaign_id, lead_id, step, status) VALUES (?, ?, 0, 'sent')").run(c, id);
  db.prepare("INSERT INTO sends (campaign_id, lead_id, step, status) VALUES (?, ?, 1, 'queued')").run(c, id);
  return { db, id };
}

test('Antwort stoppt Follow-up, auch von anderer Adresse derselben Firmen-Domain', async () => {
  const { db, id } = setup();
  const msg = await raw(['From: Hans Meier <chef@meier.de>', 'To: anna@x.de', 'Subject: Re: Frage', 'Message-ID: <a1@meier.de>', '', 'Klingt gut, rufen Sie an.']);
  const r = processMessage(db, msg, 'anna@x.de');
  assert.equal(r.kind, 'reply');
  assert.equal(r.matched, id);
  assert.equal(db.prepare('SELECT status FROM leads WHERE id = ?').get(id).status, 'replied');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sends WHERE status = 'queued'").get().n, 0);
  assert.equal(processMessage(db, msg, 'anna@x.de').duplicate, true);
});

test('Abwesenheitsnotiz zählt nicht als Antwort', async () => {
  const { db, id } = setup();
  const msg = await raw(['From: info@meier.de', 'Subject: Abwesenheitsnotiz: Frage', 'Auto-Submitted: auto-replied', '', 'Bin im Urlaub.']);
  assert.equal(classifyMessage(msg).kind, 'auto');
  processMessage(db, msg, 'anna@x.de');
  assert.equal(db.prepare('SELECT status FROM leads WHERE id = ?').get(id).status, 'new');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sends WHERE status = 'queued'").get().n, 1);
});

test('Bounce sperrt die Adresse', async () => {
  const { db } = setup();
  const msg = await raw(['From: Mail Delivery System <MAILER-DAEMON@mx.x.de>', 'Subject: Undelivered Mail Returned to Sender', '',
    'This is the mail system.', 'Final-Recipient: rfc822; info@meier.de', 'Status: 5.1.1']);
  const r = processMessage(db, msg, 'anna@x.de');
  assert.equal(r.kind, 'bounce');
  assert.deepEqual(r.matched, ['info@meier.de']);
  assert.ok(isSuppressed(db, 'info@meier.de'));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sends WHERE status = 'bounced'").get().n, 1);
});

test('Fremde Absender und Freemail-Domains werden nicht falsch zugeordnet', async () => {
  const { db } = setup();
  upsertLead(db, { source: 'osm', source_id: 'n/2', name: 'Gmail-Firma', email: 'firma@gmail.com' });
  const msg = await raw(['From: jemand@gmail.com', 'Subject: Hallo', '', 'x']);
  assert.equal(processMessage(db, msg, 'a').matched, null);
});
