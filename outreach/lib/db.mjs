import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  street TEXT, postcode TEXT, city TEXT,
  phone TEXT, email TEXT, website TEXT,
  has_website INTEGER NOT NULL DEFAULT 0,
  site_score INTEGER, site_issues TEXT,
  basis TEXT NOT NULL DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, source_id)
);
CREATE INDEX IF NOT EXISTS leads_email ON leads(email);
CREATE TABLE IF NOT EXISTS suppression (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  followup_subject TEXT,
  followup_body TEXT,
  followup_days INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'draft',
  paused_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sends (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  account TEXT,
  error TEXT,
  due_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  sent_day TEXT,
  UNIQUE(campaign_id, lead_id, step)
);
CREATE INDEX IF NOT EXISTS sends_queue ON sends(status, due_at);
CREATE INDEX IF NOT EXISTS sends_account_day ON sends(account, sent_day);
`;

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

export function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function newToken() {
  return crypto.randomBytes(16).toString('hex');
}

export function upsertLead(db, lead) {
  const existing = db.prepare('SELECT id FROM leads WHERE source = ? AND source_id = ?').get(lead.source, lead.source_id);
  const fields = {
    name: lead.name, category: lead.category ?? null, street: lead.street ?? null,
    postcode: lead.postcode ?? null, city: lead.city ?? null, phone: lead.phone ?? null,
    email: lead.email ? normEmail(lead.email) : null, website: lead.website ?? null,
    has_website: lead.website ? 1 : 0
  };
  if (existing) {
    db.prepare(`UPDATE leads SET name=$name, category=$category, street=$street, postcode=$postcode, city=$city,
      phone=COALESCE($phone, phone), email=COALESCE($email, email), website=COALESCE($website, website),
      has_website=MAX(has_website, $has_website) WHERE id=$id`).run({ ...fields, id: existing.id });
    return { id: existing.id, created: false };
  }
  const r = db.prepare(`INSERT INTO leads (source, source_id, name, category, street, postcode, city, phone, email, website, has_website, basis, token)
    VALUES ($source, $source_id, $name, $category, $street, $postcode, $city, $phone, $email, $website, $has_website, $basis, $token)`)
    .run({ ...fields, source: lead.source, source_id: String(lead.source_id), basis: lead.basis || 'none', token: newToken() });
  return { id: Number(r.lastInsertRowid), created: true };
}

export function isSuppressed(db, email) {
  return Boolean(db.prepare('SELECT 1 FROM suppression WHERE email = ?').get(normEmail(email)));
}

export function suppress(db, email, reason) {
  const e = normEmail(email);
  if (!e) return;
  db.prepare('INSERT OR IGNORE INTO suppression (email, reason) VALUES (?, ?)').run(e, reason);
  db.prepare("UPDATE leads SET status = 'unsubscribed' WHERE email = ? AND status != 'unsubscribed'").run(e);
  db.prepare(`UPDATE sends SET status = 'cancelled' WHERE status = 'queued'
    AND lead_id IN (SELECT id FROM leads WHERE email = ?)`).run(e);
}
