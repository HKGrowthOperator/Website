import express from 'express';
import nodemailer from 'nodemailer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.join(__dirname, 'site');
const app = express();
const port = Number(process.env.PORT || 3000);
const dryRun = String(process.env.FORM_DRY_RUN || '').toLowerCase() === 'true';

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

const forms = {
  'prozess-check': {
    subject: 'Neue Website-Anfrage: Prozess-Check',
    redirect: '/danke-prozess-check.html',
    honeypot: 'bot-field',
    required: ['name', 'company', 'email', 'prozess']
  },
  'erstgespraech': {
    subject: 'Neue Website-Anfrage: Individuelle Demo',
    redirect: '/danke-erstgespraech.html',
    honeypot: 'website',
    required: ['name', 'unternehmen', 'email', 'thema', 'wunschzeit']
  },
  'roi-auswertung': {
    subject: 'Neue Website-Anfrage: ROI-Auswertung',
    redirect: '/danke-roi.html',
    honeypot: 'website',
    required: ['name', 'unternehmen', 'email']
  }
};

const rateWindowMs = 10 * 60 * 1000;
const rateLimit = 12;
const submissions = new Map();

function clean(value, max = 5000) {
  return String(value ?? '').replace(/\0/g, '').trim().slice(0, max);
}

function emailLooksValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value, 320));
}

function rateLimited(ip) {
  const now = Date.now();
  const recent = (submissions.get(ip) || []).filter(ts => now - ts < rateWindowMs);
  if (recent.length >= rateLimit) {
    submissions.set(ip, recent);
    return true;
  }
  recent.push(now);
  submissions.set(ip, recent);
  return false;
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const smtpPort = Number(process.env.SMTP_PORT || 465);

  if (!host || !user || !pass) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.');
  }

  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE.toLowerCase() === 'true'
    : smtpPort === 465;

  return nodemailer.createTransport({
    host,
    port: smtpPort,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

function messageText(formName, body, req) {
  const excluded = new Set(['form-name', 'interner-empfaenger', 'bot-field', 'website']);
  const lines = [
    `Formular: ${formName}`,
    `Zeitpunkt: ${new Date().toISOString()}`,
    `IP: ${clean(req.ip, 200)}`,
    ''
  ];

  for (const [key, rawValue] of Object.entries(body)) {
    if (excluded.has(key)) continue;
    const value = clean(rawValue);
    if (!value) continue;
    lines.push(`${key}: ${value}`);
  }

  return lines.join('\n');
}

async function handleForm(req, res) {
  const formName = req.params.form;
  const config = forms[formName];
  if (!config) return res.status(404).send('Formular nicht gefunden.');

  if (rateLimited(req.ip || 'unknown')) {
    return res.status(429).send('Zu viele Anfragen. Bitte versuchen Sie es später erneut.');
  }

  if (clean(req.body?.[config.honeypot])) {
    return res.redirect(303, config.redirect);
  }

  for (const field of config.required) {
    if (!clean(req.body?.[field])) {
      return res.status(400).send('Bitte füllen Sie alle Pflichtfelder aus.');
    }
  }

  if (!emailLooksValid(req.body?.email)) {
    return res.status(400).send('Bitte geben Sie eine gültige E-Mail-Adresse an.');
  }

  if (dryRun) {
    console.log(`[forms:dry-run] ${formName}\n${messageText(formName, req.body, req)}`);
    return res.redirect(303, config.redirect);
  }

  try {
    const transporter = getTransporter();
    const to = process.env.FORM_TO || 'auftraege@hk-growthoperator.de';
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const replyTo = clean(req.body.email, 320);

    await transporter.sendMail({
      from,
      to,
      replyTo,
      subject: config.subject,
      text: messageText(formName, req.body, req)
    });

    return res.redirect(303, config.redirect);
  } catch (error) {
    console.error(`[forms] ${formName} failed:`, error?.message || error);
    return res.status(503).send(
      'Die Anfrage konnte technisch nicht versendet werden. Bitte schreiben Sie direkt an info@hk-growthoperator.de.'
    );
  }
}

app.post('/api/forms/:form', handleForm);
app.get('/health', (_req, res) => res.type('text/plain').send('ok'));

// Serve clean production URLs such as /system and /system/ from mirrored .html pages.
app.use((req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  if (req.path === '/' || path.extname(req.path)) return next();

  const relative = req.path.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!relative || relative.includes('..')) return next();

  const candidate = path.join(siteDir, `${relative}.html`);
  if (!candidate.startsWith(siteDir + path.sep)) return next();

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return res.sendFile(candidate);
  }
  return next();
});

app.use(express.static(siteDir, {
  index: 'index.html',
  fallthrough: true,
  etag: true,
  maxAge: '1h'
}));

app.use((_req, res) => {
  const notFound = path.join(siteDir, '404.html');
  if (fs.existsSync(notFound)) return res.status(404).sendFile(notFound);
  return res.status(404).type('text/plain').send('Seite nicht gefunden.');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`HK Growth Website listening on port ${port}`);
});
