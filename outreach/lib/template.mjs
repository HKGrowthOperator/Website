import { CATEGORIES } from './leads.mjs';

export function leadVars(lead, cfg) {
  const issues = lead.site_issues ? JSON.parse(lead.site_issues) : [];
  return {
    firma: lead.name,
    stadt: lead.city || '',
    branche: CATEGORIES[lead.category]?.label || '',
    website: lead.website ? lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : '',
    problem: issues[0] || '',
    probleme: issues.join(', '),
    absender: cfg.senderName
  };
}

// {{firma}} oder {{problem|Fallback-Text}}
export function render(tpl, vars) {
  return String(tpl || '').replace(/\{\{\s*(\w+)\s*(?:\|([^}]*))?\}\}/g, (_, key, fallback) => {
    const v = vars[key];
    return v != null && String(v).trim() !== '' ? String(v) : (fallback ?? '');
  });
}

export function unsubscribeUrl(cfg, lead) {
  return `${cfg.publicUrl}/u/${lead.token}`;
}

export function buildMessage({ campaign, lead, cfg, step = 0 }) {
  const vars = leadVars(lead, cfg);
  const subjectTpl = step === 0 ? campaign.subject : (campaign.followup_subject || `Re: ${campaign.subject}`);
  const bodyTpl = step === 0 ? campaign.body : campaign.followup_body;
  const unsub = unsubscribeUrl(cfg, lead);
  const footer = [
    '',
    '--',
    cfg.senderImprint,
    '',
    `Sie möchten keine weiteren Nachrichten von uns? Ein Klick genügt: ${unsub}`
  ].join('\n');
  return {
    subject: render(subjectTpl, vars).trim(),
    text: `${render(bodyTpl, vars).trim()}\n${footer}`,
    headers: {
      'List-Unsubscribe': `<${unsub}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  };
}
