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
- `deploy/nginx.conf` – Webserver-Konfiguration für saubere bestehende URLs
- `Dockerfile` – Coolify/Container-Deployment
- `.github/workflows/mirror-live-site.yml` – einmalige/reproduzierbare Sicherung des aktuellen Live-Stands

## Migration

Vor dem Domain-Switch werden insbesondere Navigation, Assets, responsive Darstellung, ROI-Rechner, Prozess-Check, Demo-Formular sowie rechtliche Seiten geprüft.
