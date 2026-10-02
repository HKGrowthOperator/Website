import nodemailer from 'nodemailer';

export function createTransports(cfg) {
  return cfg.accounts.map((a) => ({
    id: a.user,
    from: a.from || a.user,
    dailyLimit: Number(a.dailyLimit) || cfg.dailyLimit,
    transport: cfg.dryRun
      ? { sendMail: async (m) => { console.log(`[dry-run] ${a.user} -> ${m.to}: ${m.subject}`); return { messageId: 'dry-run' }; } }
      : nodemailer.createTransport({
          host: a.host, port: Number(a.port || 465),
          secure: a.secure ?? Number(a.port || 465) === 465,
          auth: { user: a.user, pass: a.pass },
          pool: true, maxConnections: 1,
          connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000
        })
  }));
}

// 5xx = dauerhafter Fehler (Adresse existiert nicht etc.) -> Adresse sperren
export function isHardBounce(err) {
  const code = Number(err?.responseCode);
  return code >= 550 && code < 560;
}
