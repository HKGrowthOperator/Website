// Meta Conversions API: serverseitige Ereignisse, nur mit Einwilligung (Cookie hk_consent) und nur mit gesetztem Token.
// Env: META_PIXEL_ID, META_CAPI_TOKEN, optional META_TEST_EVENT_CODE.
import { createHash, randomUUID } from "node:crypto";

export const newEventId = () => randomUUID();

export function hasMarketingConsent(cookieHeader) {
  const m = String(cookieHeader || "").match(/(?:^|;\s*)hk_consent=([^;]*)/);
  if (!m) return false;
  try { return JSON.parse(decodeURIComponent(m[1])).marketing === true; } catch { return false; }
}

export function fbCookies(cookieHeader) {
  const get = (n) => { const m = String(cookieHeader || "").match(new RegExp("(?:^|;\\s*)" + n + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : undefined; };
  return { fbp: get("_fbp"), fbc: get("_fbc") };
}

const sha = (v) => createHash("sha256").update(v).digest("hex");
const normEmail = (v) => String(v || "").trim().toLowerCase();
function normPhone(v) {
  let p = String(v || "").replace(/[^\d+]/g, "");
  if (!p) return "";
  if (p.startsWith("00")) p = "+" + p.slice(2);
  else if (p.startsWith("0")) p = "+49" + p.slice(1);
  return p.replace(/^\+/, "");
}

export async function sendMetaEvent({ eventName, eventId, sourceUrl, email, phone, firstName, lastName, ip, userAgent, fbp, fbc, customData, env = process.env, fetchImpl = fetch }) {
  const pixelId = env.META_PIXEL_ID, token = env.META_CAPI_TOKEN;
  if (!pixelId || !token) return { skipped: "nicht konfiguriert" };
  const em = normEmail(email), ph = normPhone(phone);
  const user_data = {};
  if (em) user_data.em = [sha(em)];
  if (ph) user_data.ph = [sha(ph)];
  if (firstName) user_data.fn = [sha(String(firstName).trim().toLowerCase())];
  if (lastName) user_data.ln = [sha(String(lastName).trim().toLowerCase())];
  if (ip) user_data.client_ip_address = ip;
  if (userAgent) user_data.client_user_agent = userAgent;
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;
  const body = { data: [{ event_name: eventName, event_time: Math.floor(Date.now() / 1000), event_id: eventId || newEventId(), event_source_url: sourceUrl, action_source: "website", user_data, ...(customData ? { custom_data: customData } : {}) }] };
  if (env.META_TEST_EVENT_CODE) body.test_event_code = env.META_TEST_EVENT_CODE;
  try {
    const res = await fetchImpl(`https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events`, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) console.error("[meta-capi]", res.status, text.slice(0, 300));
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error("[meta-capi]", err?.message || err);
    return { ok: false, error: String(err?.message || err) };
  }
}

// Liefert die Konfiguration für den Browser (window.HK_TRACKING) aus der Umgebung.
export function trackingConfigScript({ env = process.env, leadPaths = [], pathEvents = {}, privacyPath = "/datenschutz", tone = "sie" } = {}) {
  let googleConversions = {};
  try { googleConversions = env.GOOGLE_ADS_CONVERSIONS ? JSON.parse(env.GOOGLE_ADS_CONVERSIONS) : {}; } catch { googleConversions = {}; }
  const cfg = { metaPixelId: env.META_PIXEL_ID || "", googleAdsId: env.GOOGLE_ADS_ID || "", googleConversions, leadPaths, pathEvents, privacyPath, tone };
  return `window.HK_TRACKING=${JSON.stringify(cfg).replace(/</g, "\\u003c")};`;
}
