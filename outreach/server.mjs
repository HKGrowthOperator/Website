import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { openDb, upsertLead, suppress, normEmail, isSuppressed } from './lib/db.mjs';
import { CATEGORIES, findLeads } from './lib/leads.mjs';
import { enrichWebsite } from './lib/enrich.mjs';
import { buildMessage } from './lib/template.mjs';
import { createTransports } from './lib/mailer.mjs';
import { stats, startLoop, SENDABLE_BASES } from './lib/scheduler.mjs';
import { startInboxWatcher } from './lib/inbox.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASES = ['none', 'inquiry', 'consent', 'customer'];
const LEAD_STATUSES = ['new', 'contacted', 'replied', 'meeting', 'won', 'lost', 'unsubscribed'];
const CALL_OUTCOMES = ['not_reached', 'callback', 'send_info', 'meeting', 'no_interest', 'wrong_number'];

export function createApp(cfg, db, transports, deps = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false }));

  // ---------- öffentlich: Abmeldung + Health ----------
  app.get('/health', (_req, res) => res.type('text/plain').send('ok'));
  const page = (msg) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Abmeldung</title><body style="font:16px system-ui;max-width:520px;margin:15vh auto;padding:0 16px;color:#1a1a1a">${msg}</body>`;
  app.get('/u/:token', (req, res) => {
    const lead = db.prepare('SELECT id FROM leads WHERE token = ?').get(req.params.token);
    if (!lead) return res.status(404).send(page('<p>Link ungültig.</p>'));
    res.send(page(`<h1>Keine weiteren E-Mails?</h1><form method="post"><button style="font:inherit;padding:10px 18px">Ja, abmelden</button></form>`));
  });
  app.post('/u/:token', (req, res) => {
    const lead = db.prepare('SELECT email FROM leads WHERE token = ?').get(req.params.token);
    if (!lead) return res.status(404).send(page('<p>Link ungültig.</p>'));
    if (lead.email) suppress(db, lead.email, 'unsubscribe');
    db.prepare("UPDATE leads SET status = 'unsubscribed' WHERE token = ?").run(req.params.token);
    res.send(page('<h1>Erledigt.</h1><p>Sie erhalten keine weiteren Nachrichten von uns.</p>'));
  });

  // ---------- ab hier: Login ----------
  app.use((req, res, next) => {
    const [type, value] = String(req.headers.authorization || '').split(' ');
    const [u, p] = type === 'Basic' ? Buffer.from(value || '', 'base64').toString().split(/:(.*)/s) : [];
    const eq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    if (cfg.adminUser && cfg.adminPass && u != null && eq(u, cfg.adminUser) && eq(p ?? '', cfg.adminPass)) return next();
    res.set('WWW-Authenticate', 'Basic realm="outreach"').status(401).send('Login erforderlich');
  });
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/meta', (_req, res) => {
    res.json({
      categories: Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [k, v.label])),
      bases: BASES, statuses: LEAD_STATUSES, callOutcomes: CALL_OUTCOMES,
      inboxWatch: cfg.accounts.some((a) => a.imap?.host),
      allowColdEmail: cfg.allowColdEmail, dryRun: cfg.dryRun,
      senderImprintSet: Boolean(cfg.senderImprint),
      stats: stats(db, cfg, transports)
    });
  });

  // ---------- Leads ----------
  app.post('/api/leads/search', async (req, res) => {
    try {
      const city = String(req.body.city || '').trim();
      const found = await (deps.findLeads || findLeads)({ city, categories: req.body.categories, withoutWebsiteOnly: Boolean(req.body.withoutWebsiteOnly) });
      let created = 0;
      db.exec('BEGIN');
      for (const l of found) if (upsertLead(db, l).created) created += 1;
      db.exec('COMMIT');
      res.json({ found: found.length, created, withEmail: found.filter((l) => l.email).length, withoutWebsite: found.filter((l) => !l.website).length });
    } catch (err) {
      if (db.isTransaction) db.exec('ROLLBACK');
      res.status(400).json({ error: err.message });
    }
  });

  function leadFilter(q) {
    const where = [];
    const params = {};
    if (q.q) { where.push('(name LIKE $q OR email LIKE $q OR city LIKE $q)'); params.q = `%${q.q}%`; }
    if (q.city) { where.push('city = $city'); params.city = q.city; }
    if (q.category) { where.push('category = $category'); params.category = q.category; }
    if (q.status) { where.push('status = $status'); params.status = q.status; }
    if (q.basis) { where.push('basis = $basis'); params.basis = q.basis; }
    if (q.hasEmail === '1') where.push('email IS NOT NULL');
    if (q.hasEmail === '0') where.push('email IS NULL');
    if (q.hasPhone === '1') where.push('phone IS NOT NULL');
    if (q.hasWebsite === '1') where.push('has_website = 1');
    if (q.hasWebsite === '0') where.push('has_website = 0');
    if (q.maxScore) { where.push('site_score IS NOT NULL AND site_score <= $maxScore'); params.maxScore = Number(q.maxScore); }
    return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
  }

  app.get('/api/leads', (req, res) => {
    const f = leadFilter(req.query);
    const limit = Math.min(500, Number(req.query.limit) || 100);
    const offset = Number(req.query.offset) || 0;
    const total = db.prepare(`SELECT COUNT(*) n FROM leads ${f.sql}`).get(f.params).n;
    const rows = db.prepare(`SELECT * FROM leads ${f.sql} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`).all(f.params);
    res.json({ total, rows });
  });

  app.patch('/api/leads/:id', (req, res) => {
    const b = req.body;
    if (b.basis && !BASES.includes(b.basis)) return res.status(400).json({ error: 'ungültige Rechtsgrundlage' });
    if (b.status && !LEAD_STATUSES.includes(b.status)) return res.status(400).json({ error: 'ungültiger Status' });
    db.prepare(`UPDATE leads SET basis = COALESCE($basis, basis), status = COALESCE($status, status),
      email = COALESCE($email, email), notes = COALESCE($notes, notes) WHERE id = $id`)
      .run({ id: Number(req.params.id), basis: b.basis ?? null, status: b.status ?? null, email: b.email ? normEmail(b.email) : null, notes: b.notes ?? null });
    if (['replied', 'meeting', 'won', 'lost'].includes(b.status)) {
      db.prepare("UPDATE sends SET status = 'cancelled' WHERE lead_id = ? AND status = 'queued'").run(Number(req.params.id));
    }
    res.json(db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(req.params.id)));
  });

  app.post('/api/leads/enrich', async (req, res) => {
    const limit = Math.min(50, Number(req.body.limit) || 20);
    const rows = db.prepare('SELECT id, website FROM leads WHERE has_website = 1 AND site_score IS NULL LIMIT ?').all(limit);
    let emails = 0;
    for (const r of rows) {
      try {
        const e = await (deps.enrichWebsite || enrichWebsite)(r.website);
        db.prepare('UPDATE leads SET site_score = ?, site_issues = ?, email = COALESCE(email, ?) WHERE id = ?')
          .run(e.score, JSON.stringify(e.issues), e.email ? normEmail(e.email) : null, r.id);
        if (e.email) emails += 1;
      } catch (err) {
        db.prepare('UPDATE leads SET site_score = 0, site_issues = ? WHERE id = ?').run(JSON.stringify([`Website nicht erreichbar`]), r.id);
      }
    }
    const remaining = db.prepare('SELECT COUNT(*) n FROM leads WHERE has_website = 1 AND site_score IS NULL').get().n;
    res.json({ checked: rows.length, emailsFound: emails, remaining });
  });

  // CSV-Import für Kontakte MIT Rechtsgrundlage (Anfragen, Bestandskunden, Opt-ins)
  app.post('/api/leads/import', express.text({ type: '*/*', limit: '5mb' }), (req, res) => {
    const text = typeof req.body === 'string' ? req.body : String(req.body?.csv || '');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return res.status(400).json({ error: 'CSV mit Kopfzeile erwartet: name;email;city;website;phone;basis' });
    const sep = lines[0].includes(';') ? ';' : ',';
    const head = lines[0].split(sep).map((h) => h.trim().toLowerCase());
    let created = 0;
    for (const line of lines.slice(1)) {
      const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
      const row = Object.fromEntries(head.map((h, i) => [h, cols[i] || '']));
      if (!row.name || !row.email) continue;
      const basis = BASES.includes(row.basis) ? row.basis : 'none';
      const r = upsertLead(db, { source: 'import', source_id: normEmail(row.email), name: row.name, email: row.email, city: row.city, website: row.website || null, phone: row.phone, basis });
      if (r.created) created += 1;
      else db.prepare('UPDATE leads SET basis = ? WHERE id = ?').run(basis, r.id);
    }
    res.json({ created });
  });

  app.get('/api/leads/export.csv', (req, res) => {
    const f = leadFilter(req.query);
    const rows = db.prepare(`SELECT name, category, street, postcode, city, phone, email, website, site_score, site_issues, status FROM leads ${f.sql} ORDER BY city, name`).all(f.params);
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Firma', 'Branche', 'Straße', 'PLZ', 'Ort', 'Telefon', 'E-Mail', 'Website', 'Website-Score', 'Probleme', 'Status'];
    const body = rows.map((r) => [r.name, CATEGORIES[r.category]?.label, r.street, r.postcode, r.city, r.phone, r.email, r.website, r.site_score,
      r.site_issues ? JSON.parse(r.site_issues).join(', ') : '', r.status].map(esc).join(';'));
    res.type('text/csv; charset=utf-8').attachment('leads.csv').send('﻿' + [head.join(';'), ...body].join('\n'));
  });

  // ---------- Telefon-Akquise ----------
  // Reihenfolge: fällige Rückrufe zuerst, dann wenig Versuche, Firmen ohne Website, schlechte Websites
  app.get('/api/calls/queue', (req, res) => {
    const f = leadFilter({ city: req.query.city, category: req.query.category, hasPhone: '1' });
    const rows = db.prepare(`SELECT * FROM leads ${f.sql} AND status IN ('new','contacted')
      AND (callback_at IS NULL OR callback_at <= datetime('now', '+1 hour'))
      AND (last_call_at IS NULL OR last_call_at <= datetime('now', '-20 hours') OR (callback_at IS NOT NULL AND callback_at <= datetime('now', '+1 hour')))
      AND call_attempts < 5
      ORDER BY (callback_at IS NULL), callback_at, call_attempts, has_website, COALESCE(site_score, 100), id LIMIT 50`).all(f.params);
    const due = db.prepare("SELECT COUNT(*) n FROM leads WHERE callback_at IS NOT NULL AND callback_at <= datetime('now', '+1 hour') AND status IN ('new','contacted')").get().n;
    res.json({ rows, callbacksDue: due });
  });

  app.get('/api/leads/:id/calls', (req, res) => {
    res.json(db.prepare('SELECT * FROM calls WHERE lead_id = ? ORDER BY id DESC').all(Number(req.params.id)));
  });

  app.post('/api/leads/:id/call', (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
    if (!lead) return res.status(404).json({ error: 'Lead nicht gefunden' });
    if (!CALL_OUTCOMES.includes(b.outcome)) return res.status(400).json({ error: 'ungültiges Ergebnis' });
    const email = b.email ? normEmail(b.email) : lead.email;
    if (b.outcome === 'send_info' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) return res.status(400).json({ error: 'Für „Infos schicken“ wird eine E-Mail-Adresse gebraucht' });
    if (b.outcome === 'callback' && !b.callbackAt) return res.status(400).json({ error: 'Rückruf-Zeitpunkt fehlt' });

    let queued = false;
    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO calls (lead_id, outcome, note) VALUES (?, ?, ?)').run(id, b.outcome, b.note || null);
      db.prepare("UPDATE leads SET call_attempts = call_attempts + 1, last_call_at = datetime('now'), callback_at = NULL, status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END WHERE id = ?").run(id);
      if (b.note) db.prepare("UPDATE leads SET notes = TRIM(COALESCE(notes, '') || char(10) || ?) WHERE id = ?").run(`[${new Date().toISOString().slice(0, 10)}] ${b.note}`, id);
      if (b.outcome === 'callback') {
        const at = new Date(b.callbackAt);
        if (Number.isNaN(at.getTime())) throw new Error('Rückruf-Zeitpunkt ungültig');
        db.prepare('UPDATE leads SET callback_at = ?, call_attempts = call_attempts - 1 WHERE id = ?').run(at.toISOString().replace('T', ' ').slice(0, 19), id);
      }
      if (b.outcome === 'no_interest') db.prepare("UPDATE leads SET status = 'lost' WHERE id = ?").run(id);
      if (b.outcome === 'wrong_number') db.prepare("UPDATE leads SET phone = NULL WHERE id = ?").run(id);
      if (b.outcome === 'meeting') db.prepare("UPDATE leads SET status = 'meeting' WHERE id = ?").run(id);
      if (b.outcome === 'send_info') {
        // Mündliche Zustimmung am Telefon -> dokumentierte Anfrage, ab jetzt darf gemailt werden
        db.prepare("UPDATE leads SET email = ?, basis = 'inquiry' WHERE id = ?").run(email, id);
        if (b.campaignId) {
          const r = db.prepare("INSERT OR IGNORE INTO sends (campaign_id, lead_id, step, due_at) VALUES (?, ?, 0, datetime('now'))").run(Number(b.campaignId), id);
          queued = r.changes > 0;
        }
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      return res.status(400).json({ error: err.message });
    }
    const suppressed = b.outcome === 'send_info' && isSuppressed(db, email);
    res.json({ ok: true, queued, suppressed, lead: db.prepare('SELECT * FROM leads WHERE id = ?').get(id) });
  });

  app.get('/api/replies', (_req, res) => {
    res.json(db.prepare(`SELECT r.*, l.name FROM replies r LEFT JOIN leads l ON l.id = r.lead_id ORDER BY r.id DESC LIMIT 100`).all());
  });

  // ---------- Kampagnen ----------
  app.get('/api/campaigns', (_req, res) => {
    res.json(db.prepare(`SELECT c.*,
      (SELECT COUNT(*) FROM sends s WHERE s.campaign_id = c.id AND s.status = 'queued') queued,
      (SELECT COUNT(*) FROM sends s WHERE s.campaign_id = c.id AND s.status = 'sent') sent,
      (SELECT COUNT(*) FROM sends s WHERE s.campaign_id = c.id AND s.status IN ('failed','bounced')) failed,
      (SELECT COUNT(*) FROM sends s WHERE s.campaign_id = c.id AND s.status = 'skipped') skipped,
      (SELECT COUNT(DISTINCT s.lead_id) FROM sends s JOIN leads l ON l.id = s.lead_id WHERE s.campaign_id = c.id AND l.status IN ('replied','won')) replies
      FROM campaigns c ORDER BY c.id DESC`).all());
  });

  app.post('/api/campaigns', (req, res) => {
    const b = req.body;
    if (!b.name || !b.subject || !b.body) return res.status(400).json({ error: 'Name, Betreff und Text sind Pflicht' });
    const r = db.prepare(`INSERT INTO campaigns (name, subject, body, followup_subject, followup_body, followup_days) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(b.name, b.subject, b.body, b.followup_subject || null, b.followup_body || null, Number(b.followup_days) || 4);
    res.json({ id: Number(r.lastInsertRowid) });
  });

  app.patch('/api/campaigns/:id', (req, res) => {
    const b = req.body;
    const id = Number(req.params.id);
    if (b.status && !['draft', 'running', 'paused', 'done'].includes(b.status)) return res.status(400).json({ error: 'ungültiger Status' });
    if (b.status === 'running' && !cfg.senderImprint) return res.status(400).json({ error: 'SENDER_IMPRINT fehlt – ohne Impressum im Footer wird nicht versendet.' });
    db.prepare(`UPDATE campaigns SET name = COALESCE($name, name), subject = COALESCE($subject, subject), body = COALESCE($body, body),
      followup_subject = COALESCE($fs, followup_subject), followup_body = COALESCE($fb, followup_body),
      followup_days = COALESCE($fd, followup_days), status = COALESCE($status, status),
      paused_reason = CASE WHEN $status = 'running' THEN NULL ELSE paused_reason END WHERE id = $id`)
      .run({ id, name: b.name ?? null, subject: b.subject ?? null, body: b.body ?? null, fs: b.followup_subject ?? null,
        fb: b.followup_body ?? null, fd: b.followup_days != null ? Number(b.followup_days) : null, status: b.status ?? null });
    res.json(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id));
  });

  app.post('/api/campaigns/:id/enqueue', (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM campaigns WHERE id = ?').get(id)) return res.status(404).json({ error: 'Kampagne nicht gefunden' });
    const f = leadFilter({ ...req.body, hasEmail: '1' });
    const basisSql = cfg.allowColdEmail ? '' : `AND basis IN (${[...SENDABLE_BASES].map((b) => `'${b}'`).join(',')})`;
    const extra = `${f.sql ? `${f.sql} AND` : 'WHERE'} status IN ('new','contacted') ${basisSql}
      AND email NOT IN (SELECT email FROM suppression)
      AND id NOT IN (SELECT lead_id FROM sends WHERE campaign_id = $cid)`;
    const leads = db.prepare(`SELECT id FROM leads ${extra} LIMIT $max`).all({ ...f.params, cid: id, max: Math.min(20000, Number(req.body.max) || 1000) });
    const ins = db.prepare('INSERT OR IGNORE INTO sends (campaign_id, lead_id, step) VALUES (?, ?, 0)');
    db.exec('BEGIN');
    for (const l of leads) ins.run(id, l.id);
    db.exec('COMMIT');
    const blocked = cfg.allowColdEmail ? 0 : db.prepare(`SELECT COUNT(*) n FROM leads ${f.sql ? `${f.sql} AND` : 'WHERE'} basis = 'none'`).get(f.params).n;
    res.json({ queued: leads.length, blockedNoBasis: blocked });
  });

  app.post('/api/campaigns/:id/preview', (req, res) => {
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(Number(req.params.id)) || req.body.campaign;
    const lead = (req.body.leadId && db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(req.body.leadId)))
      || db.prepare('SELECT * FROM leads WHERE email IS NOT NULL ORDER BY site_score IS NULL, id DESC LIMIT 1').get()
      || { name: 'Musterbetrieb GmbH', city: 'Hamburg', category: 'handwerk', website: 'https://musterbetrieb.de', site_issues: '["nicht für Smartphones optimiert"]', token: 'beispiel' };
    if (!campaign) return res.status(404).json({ error: 'Kampagne nicht gefunden' });
    res.json({ lead: { name: lead.name, email: lead.email }, initial: buildMessage({ campaign, lead, cfg, step: 0 }),
      followup: campaign.followup_body ? buildMessage({ campaign, lead, cfg, step: 1 }) : null });
  });

  app.get('/api/sends', (req, res) => {
    res.json(db.prepare(`SELECT s.id, s.status, s.step, s.account, s.error, s.sent_at, s.due_at, l.name, l.email, c.name campaign
      FROM sends s JOIN leads l ON l.id = s.lead_id JOIN campaigns c ON c.id = s.campaign_id
      WHERE s.status != 'queued' OR s.due_at <= datetime('now') ORDER BY COALESCE(s.sent_at, s.due_at) DESC LIMIT 200`).all());
  });

  // ---------- Sperrliste ----------
  app.get('/api/suppression', (_req, res) => res.json(db.prepare('SELECT * FROM suppression ORDER BY created_at DESC LIMIT 1000').all()));
  app.post('/api/suppression', (req, res) => {
    const emails = String(req.body.emails || '').split(/[\s,;]+/).filter((e) => e.includes('@'));
    for (const e of emails) suppress(db, e, req.body.reason || 'manuell');
    res.json({ added: emails.length });
  });

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cfg = loadConfig();
  if (!cfg.adminUser || !cfg.adminPass) {
    console.error('ADMIN_USER und ADMIN_PASS müssen gesetzt sein.');
    process.exit(1);
  }
  const db = openDb(cfg.dbPath);
  const transports = createTransports(cfg);
  createApp(cfg, db, transports).listen(cfg.port, '0.0.0.0', () => {
    console.log(`[outreach] läuft auf :${cfg.port} | Postfächer: ${transports.length} | Tageslimit: ${cfg.dailyLimit} | ${cfg.dryRun ? 'DRY-RUN' : 'LIVE'} | Kaltakquise per Mail: ${cfg.allowColdEmail ? 'AN' : 'AUS'}`);
  });
  startLoop(db, cfg, transports);
  startInboxWatcher(db, cfg);
}
