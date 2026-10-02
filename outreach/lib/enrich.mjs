// Website-Check + Kontaktadresse aus Impressum/Kontaktseite (Pflichtangabe nach §5 DDG).
// Ruft pro Lead max. 3 Seiten ab – kein Crawling.

const UA = 'Mozilla/5.0 (compatible; hk-growth-sitecheck/1.0; +https://hk-growthoperator.de)';
const IGNORE_EMAIL = /(example\.|sentry|wixpress|@2x|\.png|\.jpg|\.gif|\.webp|\.svg|noreply|no-reply|datenschutz@|privacy@)/i;

export function extractEmails(html) {
  const text = String(html || '')
    .replace(/&#64;|&#x40;/gi, '@').replace(/&#46;|&#x2e;/gi, '.')
    .replace(/\s*[\[(]\s*(?:at|ät)\s*[\])]\s*/gi, '@')
    .replace(/\s*[\[(]\s*(?:dot|punkt)\s*[\])]\s*/gi, '.');
  const found = new Set();
  for (const m of text.matchAll(/mailto:([^"'?>\s]+)/gi)) found.add(decodeURIComponent(m[1]).toLowerCase());
  for (const m of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi)) found.add(m[0].toLowerCase());
  return [...found].filter((e) => !IGNORE_EMAIL.test(e));
}

export function pickBestEmail(emails, website) {
  if (!emails.length) return null;
  let host = '';
  try { host = new URL(website).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
  const onDomain = emails.filter((e) => host && e.endsWith(`@${host}`));
  const pool = onDomain.length ? onDomain : emails;
  const pref = pool.find((e) => /^(info|kontakt|contact|hallo|hello|office|mail|post)@/.test(e));
  return pref || pool[0];
}

export function auditHtml(html, { url, finalUrl, ms }) {
  const issues = [];
  const h = String(html || '');
  if (!/^https:/i.test(finalUrl || url)) issues.push('keine sichere Verbindung (kein HTTPS)');
  if (!/<meta[^>]+name=["']?viewport/i.test(h)) issues.push('nicht für Smartphones optimiert');
  if (ms > 3000) issues.push(`lädt langsam (${(ms / 1000).toFixed(1)} s)`);
  if (!/<title>[^<]{3,}<\/title>/i.test(h)) issues.push('kein Seitentitel für Google');
  if (!/<meta[^>]+name=["']?description/i.test(h)) issues.push('keine Meta-Beschreibung für Google');
  const years = [...h.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1]));
  const cur = new Date().getFullYear();
  if (years.length && Math.max(...years) < cur - 2) issues.push(`wirkt veraltet (Stand ${Math.max(...years)})`);
  if (/jimdo|wix\.com|baukasten|homepage-baukasten/i.test(h)) issues.push('Baukasten-Website');
  const score = Math.max(0, 100 - issues.length * 18);
  return { score, issues };
}

async function get(url, fetchImpl) {
  const t0 = Date.now();
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(10_000) });
  const html = (await res.text()).slice(0, 1_500_000);
  return { ok: res.ok, html, finalUrl: res.url || url, ms: Date.now() - t0 };
}

export async function enrichWebsite(website, fetchImpl = fetch) {
  const home = await get(website, fetchImpl);
  if (!home.ok) return { score: 0, issues: ['Website nicht erreichbar'], email: null };
  const audit = auditHtml(home.html, { url: website, finalUrl: home.finalUrl, ms: home.ms });
  let emails = extractEmails(home.html);
  const links = [...home.html.matchAll(/href=["']([^"'#]*(?:impressum|kontakt|contact|imprint)[^"'#]*)["']/gi)].map((m) => m[1]);
  for (const link of [...new Set(links)].slice(0, 2)) {
    if (emails.length) break;
    try {
      const page = await get(new URL(link, home.finalUrl).toString(), fetchImpl);
      if (page.ok) emails = emails.concat(extractEmails(page.html));
    } catch { /* einzelne Unterseite egal */ }
  }
  return { ...audit, email: pickBestEmail(emails, home.finalUrl) };
}
