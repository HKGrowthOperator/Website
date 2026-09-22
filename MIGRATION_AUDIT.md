# HK Growth Website — Production Migration Audit

Verified against the live website and prepared for Coolify/Hetzner on 2026-09-22.

## Result

- Fresh live snapshot vs repository: **PASS**
- Visible website migration: **PASS**
- Internal links and local assets: **PASS**
- Production dependency high-severity audit: **PASS**
- Node server syntax: **PASS**
- Docker production build: **PASS**
- Clean URLs and `.html` URLs: **PASS**
- `robots.txt` / `sitemap.xml` / OpenGraph image / webmanifest: **PASS**
- Custom 404 response: **PASS**
- Process-Check endpoint + success redirect: **PASS**
- Demo endpoint + success redirect: **PASS**
- ROI endpoint + success redirect: **PASS**
- Homepage calculator: **PASS**
- ROI calculator: **PASS**
- FAQ: **PASS**
- Demo modal open/close: **PASS**
- Mobile menu: **PASS**
- JavaScript errors on tested primary pages: **none detected**
- Local 4xx/5xx asset requests during browser test: **none detected**

## Hosting and forms

Production target: Coolify on Hetzner.

The former Netlify form transport has been replaced by local Node/Express endpoints:

```text
/api/forms/prozess-check
/api/forms/erstgespraech
/api/forms/roi-auswertung
```

Form submissions are validated server-side and sent by SMTP to the configured internal mailbox. Legacy `data-netlify` and `netlify-honeypot` attributes have been removed from the production forms. The honeypot fields themselves remain in place and are evaluated by the local server.

The server includes:

- required-field validation
- email validation
- honeypot spam protection
- short-lived IP-based rate limiting
- automatic expiry of rate-limit IP data
- no IP address in the generated inquiry email
- `Reply-To` set to the visitor email address
- basic browser security headers
- `/health` endpoint

Real outbound email delivery requires valid SMTP environment variables in Coolify.

## Legal pages

The legal pages were updated for the actual production infrastructure:

- `site/impressum.html`: current company/register data, Amtsgericht Köln, HRB 129353
- `site/datenschutz.html`: Hetzner hosting, self-hosted Coolify deployment, local form endpoints, SMTP delivery, browser-local calculators, spam protection, retention, data-subject rights and LDI NRW
- obsolete Netlify hosting/form wording removed

No legacy tax number was published. A VAT ID / business identification number should only be added if the company actually holds a number that is legally required to be published.

## Automated production verification

`.github/workflows/prepare-coolify.yml` now runs for changes to the website, server, Dockerfile and Node dependencies. It performs:

1. Coolify form cleanup
2. Node dependency installation
3. production dependency audit
4. `node --check server.mjs`
5. Docker production build
6. commit of deterministic production cleanup changes when needed

The workflow successfully produced commit `b5d5a775f10de8c7a6c5747a1437ade1d573ea43` after the updated checks, which means all preceding verification steps in that workflow completed successfully.

## Remaining cutover requirements

Before switching production traffic, configure these Coolify environment variables with the actual mailbox credentials:

```text
SMTP_HOST=...
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
FORM_TO=auftraege@hk-growthoperator.de
```

Then submit one live test through each of the three forms and verify receipt in the internal mailbox.
