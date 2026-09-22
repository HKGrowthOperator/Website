# HK Growth Website

Produktions-Repository für die aktuelle Website unter https://hk-growthoperator.de.

## Ziel

Die bestehende Live-Website wird 1:1 übernommen und anschließend über Coolify auf dem Hetzner-Server betrieben.

- Produktionsbranch: `main`
- Keine Design- oder Copy-Änderungen während der Migration
- Live-Quelle für die Migration: `https://hk-growthoperator.de`
- Ziel-Hosting: Coolify / Hetzner

## Struktur

- `site/` – gespiegelter Live-Stand der Website
- `server.mjs` – statischer Webserver + Formular-Endpunkte
- `package.json` / `package-lock.json` – Produktionsabhängigkeiten
- `Dockerfile` – Coolify/Container-Deployment auf Port `3000`
- `.github/workflows/mirror-live-site.yml` – Sicherung des aktuellen Live-Stands
- `.github/workflows/prepare-coolify.yml` – Formular-Patch + Build-Test

## Formulare

Die Live-Seite verwendete Netlify Forms. Für Coolify werden die drei bestehenden Formulare serverseitig per SMTP versendet:

- Prozess-Check
- Individuelle Demo
- ROI-Auswertung

Standard-Zieladresse: `auftraege@hk-growthoperator.de`

### Benötigte Coolify Environment Variables

```text
SMTP_HOST=...
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
FORM_TO=auftraege@hk-growthoperator.de
```

`SMTP_FROM` kann in der Regel derselben Mailbox wie `SMTP_USER` entsprechen.

## Coolify

- Build Pack: Dockerfile
- Dockerfile: `/Dockerfile`
- Exposed Port: `3000`
- Healthcheck: `/health`
- Branch: `main`

Vor dem Domain-Switch werden Navigation, Assets, responsive Darstellung, ROI-Rechner, Prozess-Check, Demo-Formular, ROI-Anfrage und rechtliche Seiten geprüft.
