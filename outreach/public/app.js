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
  ({ leads: () => loadLeads(true), campaigns: loadCampaigns, status: loadStatus, suppression: loadSuppression })[b.dataset.tab]?.();
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
