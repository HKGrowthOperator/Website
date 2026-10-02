import { isSuppressed, suppress } from './db.mjs';
import { buildMessage } from './template.mjs';
import { isHardBounce } from './mailer.mjs';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 15 * 60 * 1000;

export const SENDABLE_BASES = new Set(['consent', 'inquiry', 'customer']);

export function berlinParts(date, tz = 'Europe/Berlin') {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short'
  }).formatToParts(date).map((x) => [x.type, x.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday };
}

export function inSendWindow(date, cfg) {
  const { hour, weekday } = berlinParts(date, cfg.timezone);
  return cfg.sendDays.includes(weekday) && hour >= cfg.sendHours[0] && hour <= cfg.sendHours[1];
}

// Warm-up: Postfach startet mit WARMUP_START Mails und steigert sich pro Versandtag um WARMUP_GROWTH
export function warmupCap(cfg, accountLimit, priorSendDays) {
  return Math.min(accountLimit, Math.round(cfg.warmupStart * Math.pow(cfg.warmupGrowth, priorSendDays)));
}

export function accountCapacity(db, cfg, account, today) {
  const sentToday = db.prepare("SELECT COUNT(*) n FROM sends WHERE account = ? AND sent_day = ? AND status = 'sent'").get(account.id, today).n;
  const priorDays = db.prepare("SELECT COUNT(DISTINCT sent_day) n FROM sends WHERE account = ? AND sent_day < ? AND status = 'sent'").get(account.id, today).n;
  const cap = warmupCap(cfg, account.dailyLimit, priorDays);
  return { sentToday, cap, remaining: Math.max(0, cap - sentToday) };
}

export function stats(db, cfg, transports, now = new Date()) {
  const today = berlinParts(now, cfg.timezone).day;
  const accounts = transports.map((a) => ({ id: a.id, ...accountCapacity(db, cfg, a, today) }));
  const sentToday = db.prepare("SELECT COUNT(*) n FROM sends WHERE sent_day = ? AND status = 'sent'").get(today).n;
  const queued = db.prepare("SELECT COUNT(*) n FROM sends s JOIN campaigns c ON c.id = s.campaign_id WHERE s.status = 'queued' AND c.status = 'running'").get().n;
  const capToday = Math.min(cfg.dailyLimit, accounts.reduce((s, a) => s + a.cap, 0));
  return { today, sentToday, capToday, queued, inWindow: inSendWindow(now, cfg), accounts };
}

function checkFailureRate(db, cfg, campaignId) {
  const rows = db.prepare(`SELECT status FROM sends WHERE campaign_id = ? AND status IN ('sent','failed','bounced')
    ORDER BY COALESCE(sent_at, due_at) DESC LIMIT 100`).all(campaignId);
  if (rows.length < 30) return;
  const bad = rows.filter((r) => r.status !== 'sent').length;
  if (bad / rows.length > cfg.maxFailureRate) {
    db.prepare("UPDATE campaigns SET status = 'paused', paused_reason = ? WHERE id = ?")
      .run(`Automatisch pausiert: ${Math.round((bad / rows.length) * 100)} % Fehler/Bounces in den letzten ${rows.length} Mails. Liste prüfen!`, campaignId);
  }
}

// Verschickt höchstens EINE Mail. Rückgabe: was passiert ist (für Loop + Tests).
export async function tick(db, cfg, transports, now = new Date()) {
  if (!transports.length) return { action: 'no-accounts' };
  if (!inSendWindow(now, cfg)) return { action: 'outside-window' };
  const st = stats(db, cfg, transports, now);
  if (st.sentToday >= cfg.dailyLimit) return { action: 'daily-limit' };
  const account = transports
    .map((a) => ({ a, cap: st.accounts.find((x) => x.id === a.id) }))
    .filter((x) => x.cap.remaining > 0)
    .sort((x, y) => x.cap.sentToday - y.cap.sentToday)[0]?.a;
  if (!account) return { action: 'accounts-exhausted' };

  const nowIso = now.toISOString().replace('T', ' ').slice(0, 19);
  const job = db.prepare(`SELECT s.*, c.subject, c.body, c.followup_subject, c.followup_body, c.followup_days
    FROM sends s JOIN campaigns c ON c.id = s.campaign_id
    WHERE s.status = 'queued' AND c.status = 'running' AND s.due_at <= ?
    ORDER BY s.due_at, s.id LIMIT 1`).get(nowIso);
  if (!job) return { action: 'idle' };

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(job.lead_id);
  const skip = (status, error) => {
    db.prepare('UPDATE sends SET status = ?, error = ? WHERE id = ?').run(status, error, job.id);
    return { action: status, sendId: job.id };
  };
  if (!lead?.email) return skip('skipped', 'keine E-Mail');
  if (isSuppressed(db, lead.email)) return skip('skipped', 'abgemeldet / gesperrt');
  if (['replied', 'meeting', 'unsubscribed', 'won', 'lost'].includes(lead.status)) return skip('cancelled', `Lead-Status ${lead.status}`);
  if (!cfg.allowColdEmail && !SENDABLE_BASES.has(lead.basis)) return skip('skipped', 'keine Rechtsgrundlage (ALLOW_COLD_EMAIL=false)');

  const msg = buildMessage({ campaign: job, lead, cfg, step: job.step });
  const today = berlinParts(now, cfg.timezone).day;
  try {
    await account.transport.sendMail({
      from: account.from, to: lead.email, replyTo: cfg.replyTo || undefined,
      subject: msg.subject, text: msg.text, headers: msg.headers
    });
    db.prepare("UPDATE sends SET status = 'sent', account = ?, sent_at = ?, sent_day = ?, error = NULL WHERE id = ?")
      .run(account.id, nowIso, today, job.id);
    if (lead.status === 'new') db.prepare("UPDATE leads SET status = 'contacted' WHERE id = ?").run(lead.id);
    if (job.step === 0 && job.followup_body) {
      const due = new Date(now.getTime() + job.followup_days * 86400_000).toISOString().replace('T', ' ').slice(0, 19);
      db.prepare('INSERT OR IGNORE INTO sends (campaign_id, lead_id, step, due_at) VALUES (?, ?, 1, ?)').run(job.campaign_id, lead.id, due);
    }
    return { action: 'sent', sendId: job.id, to: lead.email, account: account.id };
  } catch (err) {
    const bounced = isHardBounce(err);
    const error = String(err?.message || err).slice(0, 500);
    // Vorübergehende Fehler (Verbindung, 4xx): bis zu 3 Versuche mit 15 Min. Abstand
    if (!bounced && job.attempts < MAX_ATTEMPTS - 1) {
      const retryAt = new Date(now.getTime() + RETRY_DELAY_MS).toISOString().replace('T', ' ').slice(0, 19);
      db.prepare('UPDATE sends SET attempts = attempts + 1, due_at = ?, account = ?, error = ? WHERE id = ?').run(retryAt, account.id, error, job.id);
      return { action: 'retry', sendId: job.id, error };
    }
    db.prepare('UPDATE sends SET status = ?, attempts = attempts + 1, account = ?, sent_at = ?, error = ? WHERE id = ?')
      .run(bounced ? 'bounced' : 'failed', account.id, nowIso, error, job.id);
    if (bounced) suppress(db, lead.email, 'bounce');
    checkFailureRate(db, cfg, job.campaign_id);
    return { action: bounced ? 'bounced' : 'failed', sendId: job.id, error: err?.message };
  }
}

export function startLoop(db, cfg, transports, log = console) {
  let stopped = false;
  let timer;
  const rand = () => (cfg.minDelaySec + Math.random() * Math.max(0, cfg.maxDelaySec - cfg.minDelaySec)) * 1000;
  async function run() {
    if (stopped) return;
    let next = 60_000;
    try {
      const r = await tick(db, cfg, transports);
      if (['sent', 'failed', 'bounced', 'retry'].includes(r.action)) {
        log.log(`[send] ${r.action} ${r.to || ''} ${r.error || ''}`.trim());
        next = rand();
      } else if (['skipped', 'cancelled'].includes(r.action)) {
        next = 200;
      }
    } catch (err) {
      log.error('[send] loop error', err);
    }
    timer = setTimeout(run, next);
  }
  timer = setTimeout(run, 2000);
  return () => { stopped = true; clearTimeout(timer); };
}
