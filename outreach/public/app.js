const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let META = null;
let leadOffset = 0;

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => (t.style.display = 'none'), 3500); }

async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}
const run = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };

document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('nav button, section').forEach((x) => x.classList.remove('active'));
  b.classList.add('active'); $(`#${b.dataset.tab}`).classList.add('active');
  ({ leads: () => loadLeads(true), phone: loadQueue, campaigns: loadCampaigns, status: loadStatus, suppression: loadSuppression })[b.dataset.tab]?.();
}));

async function loadMeta() {
  META = await api('/api/meta');
  const n = [];
  if (META.dryRun) n.push('Testmodus aktiv (DRY_RUN=true): Es wird nichts wirklich verschickt.');
  if (!META.senderImprintSet) n.push('SENDER_IMPRINT fehlt. Ohne Impressum im Footer lassen sich Kampagnen nicht starten.');
  if (!META.allowColdEmail) n.push('E-Mails gehen nur an Leads mit Rechtsgrundlage (Anfrage, Opt-in, Bestandskunde). Kalte Leads: CSV exportieren und anrufen oder per Brief anschreiben.');
  else n.push('ALLOW_COLD_EMAIL=true: Werbe-Mails ohne Einwilligung können nach §7 UWG abgemahnt werden. Das Risiko liegt bei euch.');
  $('#notices').innerHTML = n.map((x) => `<div class="notice">${esc(x)}</div>`).join('');
  $('#f-cats').innerHTML = Object.entries(META.categories).map(([k, v]) => `<label><input type="checkbox" value="${k}" checked>${esc(v)}</label>`).join('');
  $('#p-cat').innerHTML += Object.entries(META.categories).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  $('#l-cat').innerHTML += Object.entries(META.categories).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  $('#l-status').innerHTML += META.statuses.map((s) => `<option>${s}</option>`).join('');
}

$('#f-go').addEventListener('click', run(async () => {
  const btn = $('#f-go'); btn.disabled = true; $('#f-result').textContent = 'Suche läuft (bis zu 2 Minuten) …';
  try {
    const cats = [...document.querySelectorAll('#f-cats input:checked')].map((i) => i.value);
    const r = await api('/api/leads/search', { method: 'POST', body: { city: $('#f-city').value, categories: cats, withoutWebsiteOnly: $('#f-nosite').checked } });
    $('#f-result').textContent = `${r.found} gefunden, ${r.created} neu, ${r.withoutWebsite} ohne Website, ${r.withEmail} mit E-Mail.`;
  } finally { btn.disabled = false; }
}));

$('#e-go').addEventListener('click', run(async () => {
  $('#e-result').textContent = 'Prüfe …';
  const r = await api('/api/leads/enrich', { method: 'POST', body: { limit: 20 } });
  $('#e-result').textContent = `${r.checked} geprüft, ${r.emailsFound} E-Mails gefunden, ${r.remaining} offen.`;
}));

$('#i-go').addEventListener('click', run(async () => {
  const r = await api('/api/leads/import', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: $('#i-csv').value });
  $('#i-result').textContent = `${r.created} neue Kontakte importiert.`;
}));

function leadQuery() {
  return new URLSearchParams(Object.entries({ q: $('#l-q').value, category: $('#l-cat').value, hasWebsite: $('#l-site').value, hasEmail: $('#l-mail').value, status: $('#l-status').value }).filter(([, v]) => v));
}
async function loadLeads(reset) {
  if (reset) { leadOffset = 0; $('#l-body').innerHTML = ''; }
  const q = leadQuery(); q.set('offset', leadOffset); q.set('limit', 100);
  const r = await api(`/api/leads?${q}`);
  leadOffset += r.rows.length;
  $('#l-count').textContent = `${r.total} Leads`;
  $('#l-more').style.display = leadOffset < r.total ? '' : 'none';
  $('#l-body').insertAdjacentHTML('beforeend', r.rows.map((l) => {
    const issues = l.site_issues ? JSON.parse(l.site_issues) : [];
    const site = l.website ? `<a href="${esc(l.website)}" target="_blank" rel="noopener">${esc(l.website.replace(/^https?:\/\//, '').slice(0, 30))}</a>${l.site_score != null ? `<br><span class="${l.site_score < 60 ? 'bad' : 'ok'}">${l.site_score}/100</span> <span class="muted">${esc(issues.join(', '))}</span>` : ''}` : '<span class="bad">keine</span>';
    return `<tr data-id="${l.id}"><td><b>${esc(l.name)}</b><br><span class="muted">${esc(META.categories[l.category] || '')}</span></td>
      <td>${esc([l.street, [l.postcode, l.city].filter(Boolean).join(' ')].filter(Boolean).join(', '))}</td>
      <td>${esc(l.phone || '')}<br>${esc(l.email || '')}</td><td>${site}</td>
      <td><select data-f="basis">${META.bases.map((b) => `<option ${b === l.basis ? 'selected' : ''}>${b}</option>`).join('')}</select></td>
      <td><select data-f="status">${META.statuses.map((s) => `<option ${s === l.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`;
  }).join(''));
}
$('#l-body').addEventListener('change', run(async (e) => {
  const id = e.target.closest('tr').dataset.id;
  await api(`/api/leads/${id}`, { method: 'PATCH', body: { [e.target.dataset.f]: e.target.value } });
  toast('Gespeichert');
}));
['#l-q', '#l-cat', '#l-site', '#l-mail', '#l-status'].forEach((s) => $(s).addEventListener('change', run(() => loadLeads(true))));
$('#l-more').addEventListener('click', run(() => loadLeads(false)));
$('#l-csv').addEventListener('click', () => { location.href = `/api/leads/export.csv?${leadQuery()}`; });

const DEFAULT_BODY = `Guten Tag,

ich bin bei der Suche nach {{branche}} in {{stadt}} auf {{firma}} gestoßen. {{problem|Mir ist aufgefallen, dass man Sie online kaum findet.}}

Wir bauen für Betriebe wie Ihren schlanke Websites, die bei Google gefunden werden und Anfragen bringen – Festpreis, in zwei Wochen online.

Darf ich Ihnen kostenlos einen Entwurf zeigen, wie das für {{firma}} aussehen könnte?

Viele Grüße
{{absender}}`;

function fillCampaign(c = {}) {
  $('#c-id').value = c.id || ''; $('#c-name').value = c.name || ''; $('#c-subject').value = c.subject || 'Kurze Frage zu {{firma}}';
  $('#c-body').value = c.body || DEFAULT_BODY; $('#c-fdays').value = c.followup_days || 4;
  $('#c-fsubject').value = c.followup_subject || ''; $('#c-fbody').value = c.followup_body || '';
  $('#c-title').textContent = c.id ? `Kampagne bearbeiten: ${c.name}` : 'Neue Kampagne'; $('#c-prev').innerHTML = '';
}
function campaignForm() {
  return { name: $('#c-name').value, subject: $('#c-subject').value, body: $('#c-body').value, followup_days: $('#c-fdays').value, followup_subject: $('#c-fsubject').value, followup_body: $('#c-fbody').value };
}
let CAMPAIGNS = [];
async function loadCampaigns() {
  CAMPAIGNS = await api('/api/campaigns');
  $('#c-body-list').innerHTML = CAMPAIGNS.map((c) => `<tr data-id="${c.id}"><td><b>${esc(c.name)}</b>${c.paused_reason ? `<br><span class="bad">${esc(c.paused_reason)}</span>` : ''}</td>
    <td>${esc(c.status)}</td><td>${c.queued}</td><td>${c.sent}</td><td>${c.failed}</td><td>${c.replies}</td>
    <td><button class="btn ghost" data-a="edit">Bearbeiten</button> <button class="btn ghost" data-a="enqueue">Leads hinzufügen</button>
    ${c.status === 'running' ? '<button class="btn ghost" data-a="pause">Pausieren</button>' : '<button class="btn" data-a="start">Starten</button>'}</td></tr>`).join('');
}
$('#c-body-list').addEventListener('click', run(async (e) => {
  const a = e.target.dataset.a; if (!a) return;
  const id = e.target.closest('tr').dataset.id;
  if (a === 'edit') { fillCampaign(CAMPAIGNS.find((c) => String(c.id) === id)); window.scrollTo(0, 0); return; }
  if (a === 'start' || a === 'pause') await api(`/api/campaigns/${id}`, { method: 'PATCH', body: { status: a === 'start' ? 'running' : 'paused' } });
  if (a === 'enqueue') {
    const city = prompt('Nur Leads aus dieser Stadt? (leer = alle)', '') ?? null; if (city === null) return;
    const max = prompt('Wie viele Leads maximal einreihen?', '500'); if (!max) return;
    const r = await api(`/api/campaigns/${id}/enqueue`, { method: 'POST', body: { city: city || undefined, max } });
    toast(`${r.queued} eingereiht${r.blockedNoBasis ? `, ${r.blockedNoBasis} ohne Rechtsgrundlage übersprungen` : ''}`);
  }
  loadCampaigns();
}));
$('#c-save').addEventListener('click', run(async () => {
  const id = $('#c-id').value;
  if (id) await api(`/api/campaigns/${id}`, { method: 'PATCH', body: campaignForm() });
  else { const r = await api('/api/campaigns', { method: 'POST', body: campaignForm() }); $('#c-id').value = r.id; }
  toast('Gespeichert'); loadCampaigns();
}));
$('#c-preview').addEventListener('click', run(async () => {
  const id = $('#c-id').value || 0;
  const r = await api(`/api/campaigns/${id}/preview`, { method: 'POST', body: { campaign: campaignForm() } });
  const show = (m) => `<p><b>Betreff:</b> ${esc(m.subject)}</p><pre>${esc(m.text)}</pre>`;
  $('#c-prev').innerHTML = `<p class="muted">Beispiel-Lead: ${esc(r.lead.name)}</p>${show(r.initial)}${r.followup ? `<h2>Follow-up</h2>${show(r.followup)}` : ''}`;
}));
$('#c-new').addEventListener('click', () => fillCampaign());

async function loadStatus() {
  const m = await api('/api/meta'); const s = m.stats;
  $('#s-kpis').innerHTML = [[s.sentToday, 'heute gesendet'], [s.capToday, 'Limit heute (inkl. Warm-up)'], [s.queued, 'in Warteschlange'], [s.inWindow ? 'aktiv' : 'Pause', 'Versandfenster']]
    .map(([v, l]) => `<div class="kpi"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  $('#s-acc').innerHTML = s.accounts.map((a) => `<tr><td>${esc(a.id)}</td><td>${a.sentToday}</td><td>${a.cap}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Keine Postfächer in SMTP_ACCOUNTS</td></tr>';
  $('#s-inbox').textContent = m.inboxWatch ? 'Postfach-Überwachung aktiv.' : 'Keine IMAP-Daten in SMTP_ACCOUNTS: Antworten bitte manuell als „replied“ markieren.';
  const rep = await api('/api/replies');
  const kinds = { reply: 'Antwort', auto: 'Abwesenheit', bounce: 'Bounce' };
  $('#s-replies').innerHTML = rep.map((r) => `<tr><td>${esc(r.received_at)}</td><td class="${r.kind === 'reply' ? 'ok' : r.kind === 'bounce' ? 'bad' : 'muted'}">${kinds[r.kind] || esc(r.kind)}</td>
    <td>${esc(r.from_email)}</td><td>${esc(r.name || '')}</td><td><b>${esc(r.subject)}</b><br><span class="muted">${esc((r.snippet || '').slice(0, 160))}</span></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Noch nichts eingegangen</td></tr>';
  const log = await api('/api/sends');
  $('#s-log').innerHTML = log.map((x) => `<tr><td>${esc(x.sent_at || x.due_at)}</td><td>${esc(x.campaign)}</td><td>${esc(x.name)}<br><span class="muted">${esc(x.email)}</span></td>
    <td>${x.step ? 'Follow-up' : 'Erstmail'}</td><td class="${x.status === 'sent' ? 'ok' : ['failed', 'bounced'].includes(x.status) ? 'bad' : ''}">${esc(x.status)}</td><td class="muted">${esc(x.error || x.account || '')}</td></tr>`).join('');
}
async function loadSuppression() {
  const rows = await api('/api/suppression');
  $('#x-body').innerHTML = rows.map((r) => `<tr><td>${esc(r.email)}</td><td>${esc(r.reason)}</td><td>${esc(r.created_at)}</td></tr>`).join('');
}
$('#x-go').addEventListener('click', run(async () => {
  const r = await api('/api/suppression', { method: 'POST', body: { emails: $('#x-emails').value } });
  toast(`${r.added} gesperrt`); $('#x-emails').value = ''; loadSuppression();
}));

run(async () => { await loadMeta(); fillCampaign(); })();

// ---------- Telefon ----------
const DEFAULT_SCRIPT = `Guten Tag, hier ist {{ich}} von HK Growth. Spreche ich mit dem Inhaber von {{firma}}?

Ich rufe kurz an, weil wir {{branche}} in {{stadt}} helfen, online mehr Anfragen zu bekommen.
{{problem}}

Frage: Wie kommen neue Kunden heute zu Ihnen?

Bei Interesse:   „Darf ich Ihnen zwei, drei Beispiele per Mail schicken? An welche Adresse?“  → Infos schicken
Termin möglich:  „Passt Ihnen ein 15-Minuten-Gespräch am … ?“                                → Termin
Kein Interesse:  „Verstehe, danke für Ihre Zeit. Darf ich mich in einem halben Jahr nochmal melden?“`;
const OUTCOME_LABELS = { not_reached: 'Nicht erreicht', callback: 'Rückruf vereinbart', send_info: 'Infos schicken (Mail ok)', meeting: 'Termin', no_interest: 'Kein Interesse', wrong_number: 'Falsche Nummer' };
let QUEUE = [];
let CURRENT = null;
try { $('#p-script').value = localStorage.getItem('callScript') || DEFAULT_SCRIPT; } catch { $('#p-script').value = DEFAULT_SCRIPT; }
$('#p-script').addEventListener('input', () => { try { localStorage.setItem('callScript', $('#p-script').value); } catch { /* egal */ } if (CURRENT) showLead(CURRENT); });

async function loadQueue() {
  const camps = await api('/api/campaigns');
  const sel = $('#p-camp'); const keep = sel.value;
  sel.innerHTML = '<option value="">keine (nur markieren)</option>' + camps.map((c) => `<option value="${c.id}">${esc(c.name)} (${esc(c.status)})</option>`).join('');
  sel.value = keep;
  const q = new URLSearchParams(Object.entries({ city: $('#p-city').value, category: $('#p-cat').value }).filter(([, v]) => v));
  const r = await api(`/api/calls/queue?${q}`);
  QUEUE = r.rows;
  $('#p-due').textContent = r.callbacksDue ? `${r.callbacksDue} Rückrufe fällig` : '';
  $('#p-list').innerHTML = QUEUE.map((l, i) => `<div class="qitem" data-i="${i}"><b>${esc(l.name)}</b>
    <small>${esc(META.categories[l.category] || '')} · ${esc(l.city || '')}${l.callback_at ? ` · Rückruf ${esc(l.callback_at.slice(5, 16))}` : ''}${l.call_attempts ? ` · ${l.call_attempts}× versucht` : ''}</small></div>`).join('')
    || '<p class="muted" style="padding:12px">Keine Leads mit Telefonnummer offen.</p>';
  if (QUEUE.length) showLead(QUEUE[0]); else $('#p-detail').innerHTML = '<p class="muted">Liste leer.</p>';
}
$('#p-reload').addEventListener('click', run(loadQueue));
$('#p-list').addEventListener('click', (e) => { const it = e.target.closest('.qitem'); if (it) showLead(QUEUE[Number(it.dataset.i)]); });

function scriptFor(l) {
  const issues = l.site_issues ? JSON.parse(l.site_issues) : [];
  const problem = !l.website ? 'Mir ist aufgefallen, dass Sie noch keine eigene Website haben.' : issues.length ? `Ich habe mir Ihre Website angesehen: Sie ist ${issues.slice(0, 2).join(' und ')}.` : '';
  const vars = { firma: l.name, stadt: l.city || 'Ihrer Region', branche: META.categories[l.category] || 'Betriebe', problem, ich: '[Name]' };
  return $('#p-script').value.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

async function showLead(l) {
  CURRENT = l;
  document.querySelectorAll('.qitem').forEach((x) => x.classList.toggle('active', QUEUE[Number(x.dataset.i)] === l));
  const issues = l.site_issues ? JSON.parse(l.site_issues) : [];
  const history = await api(`/api/leads/${l.id}/calls`);
  const tomorrow = new Date(Date.now() + 86400_000); tomorrow.setHours(10, 0, 0, 0);
  const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  $('#p-detail').innerHTML = `<h2>${esc(l.name)}</h2>
    <a class="tel" href="tel:${esc(String(l.phone).replace(/[^\d+]/g, ''))}">${esc(l.phone)}</a>
    <p class="muted">${esc([l.street, [l.postcode, l.city].filter(Boolean).join(' ')].filter(Boolean).join(', '))} · ${esc(META.categories[l.category] || '')}</p>
    <p>${l.website ? `<a href="${esc(l.website)}" target="_blank" rel="noopener">${esc(l.website)}</a> ${l.site_score != null ? `(${l.site_score}/100) <span class="muted">${esc(issues.join(', '))}</span>` : ''}` : '<span class="bad">Keine Website</span>'}</p>
    ${l.notes ? `<pre>${esc(l.notes)}</pre>` : ''}
    <div class="card script">${esc(scriptFor(l))}</div>
    <div class="row">
      <div><label>E-Mail (für „Infos schicken“)</label><input id="p-email" value="${esc(l.email || '')}" placeholder="name@firma.de"></div>
      <div><label>Rückruf am</label><input id="p-cb" type="datetime-local" value="${local}"></div>
    </div>
    <label>Notiz</label><input id="p-note" placeholder="z. B. Chef ab 14 Uhr da, will Preise wissen">
    <div class="outcomes">${META.callOutcomes.map((o) => `<button class="btn ${o === 'send_info' || o === 'meeting' ? '' : 'ghost'}" data-o="${o}">${OUTCOME_LABELS[o] || o}</button>`).join('')}</div>
    ${history.length ? `<h2 style="margin-top:16px">Verlauf</h2><table>${history.map((h) => `<tr><td>${esc(h.created_at)}</td><td>${esc(OUTCOME_LABELS[h.outcome] || h.outcome)}</td><td class="muted">${esc(h.note || '')}</td></tr>`).join('')}</table>` : ''}`;
}

$('#p-detail').addEventListener('click', run(async (e) => {
  const o = e.target.dataset.o; if (!o || !CURRENT) return;
  const body = { outcome: o, note: $('#p-note').value, email: $('#p-email').value, campaignId: $('#p-camp').value || undefined };
  if (o === 'callback') body.callbackAt = new Date($('#p-cb').value).toISOString();
  const r = await api(`/api/leads/${CURRENT.id}/call`, { method: 'POST', body });
  toast(r.suppressed ? 'Achtung: Adresse steht auf der Sperrliste, Mail wird nicht verschickt.' : r.queued ? 'Gespeichert, Mail ist eingeplant.' : `Gespeichert: ${OUTCOME_LABELS[o]}`);
  const idx = QUEUE.indexOf(CURRENT);
  QUEUE.splice(idx, 1);
  $('#p-list').querySelectorAll('.qitem')[idx]?.remove();
  $('#p-list').querySelectorAll('.qitem').forEach((x, i) => (x.dataset.i = i));
  if (QUEUE[idx] || QUEUE[idx - 1]) showLead(QUEUE[idx] || QUEUE[idx - 1]); else loadQueue();
}));
