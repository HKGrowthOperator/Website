// Liest die Outreach-Postfächer per IMAP mit (nur lesen, nichts wird verschoben oder gelöscht):
// - Antwort eines Leads  -> Lead 'replied', offene Follow-ups werden gestoppt
// - Bounce/Unzustellbar  -> Adresse gesperrt, Send als 'bounced' markiert
// - Abwesenheitsnotiz    -> wird nur protokolliert, zählt nicht als Antwort
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { normEmail, suppress } from './db.mjs';

const FREEMAIL = /@(gmail|googlemail|gmx|web|t-online|yahoo|outlook|hotmail|live|icloud|me|aol|freenet|posteo|mail|arcor|1und1)\./i;
const AUTO_SUBJECT = /(abwesen|out of office|automatische antwort|auto[- ]?reply|autoreply|urlaub|nicht im büro|vacation)/i;
const BOUNCE_FROM = /(mailer-daemon|postmaster|mail delivery)/i;
const BOUNCE_SUBJECT = /(undeliver|unzustellbar|delivery status notification|returned mail|failure notice|nicht zugestellt|delivery failure)/i;

function header(parsed, name) {
  const v = parsed.headers?.get?.(name);
  return v == null ? '' : String(typeof v === 'object' && v.value ? v.value : v).toLowerCase();
}

export function classifyMessage(parsed) {
  const from = normEmail(parsed.from?.value?.[0]?.address);
  const subject = String(parsed.subject || '');
  const text = String(parsed.text || '');
  const ctype = header(parsed, 'content-type');
  if (BOUNCE_FROM.test(from) || BOUNCE_SUBJECT.test(subject) || ctype.includes('multipart/report')) {
    const recipients = new Set();
    for (const m of text.matchAll(/(?:final|original)-recipient:\s*rfc822;\s*<?([^\s>]+@[^\s>]+)>?/gi)) recipients.add(normEmail(m[1]));
    if (!recipients.size) for (const m of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi)) recipients.add(normEmail(m[0]));
    return { kind: 'bounce', from, subject, recipients: [...recipients].filter((e) => !BOUNCE_FROM.test(e)) };
  }
  const auto = header(parsed, 'auto-submitted');
  const precedence = header(parsed, 'precedence');
  if ((auto && auto !== 'no') || header(parsed, 'x-autoreply') || header(parsed, 'x-autorespond')
    || ['auto_reply', 'bulk', 'junk'].includes(precedence) || AUTO_SUBJECT.test(subject)) {
    return { kind: 'auto', from, subject };
  }
  return { kind: 'reply', from, subject };
}

export function findLeadForSender(db, email) {
  const exact = db.prepare('SELECT * FROM leads WHERE email = ?').get(email);
  if (exact || !email || FREEMAIL.test(email)) return exact || null;
  const domain = email.split('@')[1];
  const matches = db.prepare('SELECT * FROM leads WHERE email LIKE ?').all(`%@${domain}`);
  return matches.length === 1 ? matches[0] : null;
}

export function processMessage(db, parsed, account) {
  const c = classifyMessage(parsed);
  const messageId = parsed.messageId || null;
  if (messageId && db.prepare('SELECT 1 FROM replies WHERE message_id = ?').get(messageId)) return { ...c, duplicate: true };
  const snippet = String(parsed.text || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const log = (leadId) => db.prepare('INSERT OR IGNORE INTO replies (lead_id, kind, account, from_email, subject, snippet, message_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(leadId, c.kind, account, c.from, c.subject.slice(0, 300), snippet, messageId);

  if (c.kind === 'bounce') {
    const sent = c.recipients.filter((e) => db.prepare("SELECT 1 FROM sends s JOIN leads l ON l.id = s.lead_id WHERE l.email = ? AND s.status = 'sent'").get(e));
    for (const e of sent) {
      suppress(db, e, 'bounce');
      db.prepare("UPDATE sends SET status = 'bounced', error = 'Bounce per Postfach erkannt' WHERE status = 'sent' AND lead_id IN (SELECT id FROM leads WHERE email = ?)").run(e);
    }
    const lead = sent[0] ? db.prepare('SELECT id FROM leads WHERE email = ?').get(sent[0]) : null;
    log(lead?.id ?? null);
    return { ...c, matched: sent };
  }

  const lead = findLeadForSender(db, c.from);
  if (!lead) return { ...c, matched: null };
  log(lead.id);
  if (c.kind === 'reply') {
    if (!['won', 'lost', 'unsubscribed', 'meeting'].includes(lead.status)) db.prepare("UPDATE leads SET status = 'replied' WHERE id = ?").run(lead.id);
    db.prepare("UPDATE sends SET status = 'cancelled', error = 'Lead hat geantwortet' WHERE lead_id = ? AND status = 'queued'").run(lead.id);
  }
  return { ...c, matched: lead.id };
}

export async function pollAccount(db, account, log = console) {
  const imap = account.imap;
  const client = new ImapFlow({
    host: imap.host, port: Number(imap.port || 993), secure: imap.secure ?? true,
    auth: { user: imap.user || account.user, pass: imap.pass || account.pass }, logger: false
  });
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  let handled = 0;
  try {
    const box = client.mailbox;
    const state = db.prepare('SELECT * FROM inbox_state WHERE account = ?').get(account.user);
    const sameBox = state && state.uid_validity === String(box.uidValidity);
    const range = sameBox ? `${state.last_uid + 1}:*` : null;
    const query = range ? { uid: range } : { since: new Date(Date.now() - 14 * 86400_000) };
    let maxUid = sameBox ? state.last_uid : 0;
    for await (const msg of client.fetch(query, { uid: true, source: true }, { uid: true })) {
      if (sameBox && msg.uid <= state.last_uid) continue;
      maxUid = Math.max(maxUid, msg.uid);
      try {
        const r = processMessage(db, await simpleParser(msg.source), account.user);
        if (r.matched && (!Array.isArray(r.matched) || r.matched.length)) handled += 1;
      } catch (err) {
        log.error(`[inbox] ${account.user} uid ${msg.uid}:`, err.message);
      }
    }
    db.prepare(`INSERT INTO inbox_state (account, uid_validity, last_uid) VALUES (?, ?, ?)
      ON CONFLICT(account) DO UPDATE SET uid_validity = excluded.uid_validity, last_uid = excluded.last_uid`)
      .run(account.user, String(box.uidValidity), maxUid);
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return handled;
}

export function startInboxWatcher(db, cfg, log = console) {
  const accounts = cfg.accounts.filter((a) => a.imap?.host);
  if (!accounts.length) return () => {};
  let stopped = false;
  let timer;
  async function run() {
    for (const a of accounts) {
      if (stopped) return;
      try {
        const n = await pollAccount(db, a, log);
        if (n) log.log(`[inbox] ${a.user}: ${n} Antworten/Bounces verarbeitet`);
      } catch (err) {
        log.error(`[inbox] ${a.user}: ${err.message}`);
      }
    }
    if (!stopped) timer = setTimeout(run, cfg.inboxPollSec * 1000);
  }
  timer = setTimeout(run, 5000);
  return () => { stopped = true; clearTimeout(timer); };
}
