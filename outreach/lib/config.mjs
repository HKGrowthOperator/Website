const env = process.env;

function num(name, fallback) {
  const v = Number(env[name]);
  return Number.isFinite(v) && env[name] !== '' && env[name] != null ? v : fallback;
}

function parseAccounts(raw) {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((a) => a && a.host && a.user) : [];
  } catch {
    console.error('[config] SMTP_ACCOUNTS ist kein gültiges JSON');
    return [];
  }
}

function parseRange(raw, fallback) {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(String(raw || '').trim());
  return m ? [Number(m[1]), Number(m[2])] : fallback;
}

export function loadConfig() {
  return {
    port: num('PORT', 3100),
    dbPath: env.DB_PATH || './data/outreach.db',
    publicUrl: (env.PUBLIC_URL || 'http://localhost:3100').replace(/\/+$/, ''),
    adminUser: env.ADMIN_USER || '',
    adminPass: env.ADMIN_PASS || '',
    senderName: env.SENDER_NAME || 'HK Growth Operator',
    senderImprint: env.SENDER_IMPRINT || '',
    replyTo: env.REPLY_TO || '',
    accounts: parseAccounts(env.SMTP_ACCOUNTS),
    dailyLimit: num('DAILY_LIMIT', 200),
    warmupStart: num('WARMUP_START', 20),
    warmupGrowth: num('WARMUP_GROWTH', 1.25),
    minDelaySec: num('MIN_DELAY_SEC', 45),
    maxDelaySec: num('MAX_DELAY_SEC', 120),
    sendDays: String(env.SEND_DAYS || '1,2,3,4,5').split(',').map(Number).filter((n) => n >= 0 && n <= 6),
    sendHours: parseRange(env.SEND_HOURS, [8, 17]),
    maxFailureRate: num('MAX_FAILURE_RATE', 0.05),
    inboxPollSec: num('INBOX_POLL_SEC', 300),
    allowColdEmail: String(env.ALLOW_COLD_EMAIL || '').toLowerCase() === 'true',
    dryRun: String(env.DRY_RUN ?? 'true').toLowerCase() !== 'false',
    timezone: 'Europe/Berlin'
  };
}
