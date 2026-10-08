# HK Outreach – Lead-Finder & Akquise-Tool

Eigenständige App (läuft getrennt von der Website), um:

1. **Leads finden**: Firmen pro Stadt und Branche aus OpenStreetMap, auf Wunsch nur Firmen **ohne Website**.
2. **Websites prüfen**: HTTPS, Handy-Optimierung, Ladezeit, Google-Basics, Alter, Baukasten. Die Kontakt-E-Mail wird aus Startseite und Impressum gelesen.
3. **Kampagnen versenden**: personalisierte Mails (`{{firma}}`, `{{problem}}` …) mit automatischem Follow-up, Warm-up, Tageslimit, Versandfenster, Abmeldelink und Sperrliste.
4. **Telefon-Akquise**: Anrufliste mit Gesprächsleitfaden, Rückruf-Terminen und Ergebnis-Buttons. „Infos schicken“ speichert die E-Mail, markiert den Lead als Anfrage und plant die Mail direkt ein.
5. **Postfach mitlesen (IMAP, optional)**: Antworten stoppen Follow-ups automatisch, Bounces werden gesperrt, Abwesenheitsnotizen ignoriert.
6. **CSV-Export** für Serienbriefe.

## Start

```bash
cd outreach
cp .env.example .env    # ausfüllen
npm ci
set -a; . ./.env; set +a
npm start               # http://localhost:3100 (Basic-Auth: ADMIN_USER / ADMIN_PASS)
npm test
```

Deployment in Coolify: eigener Service mit `outreach/Dockerfile`, Volume auf `/app/data` (SQLite-Datenbank), Env-Variablen aus `.env.example`.
`PUBLIC_URL` muss öffentlich erreichbar sein, sonst funktionieren die Abmeldelinks nicht.

## Ablauf

1. **Leads finden** → Stadt + Branchen → *Suchen & speichern*
2. **Websites prüfen** (mehrmals klicken, 20 pro Durchgang)
3. **Kampagnen** → „Infos“-Mail schreiben (z. B. „Wie besprochen, hier die Beispiele für {{firma}}“) → *Starten*
4. **Telefon** → Kampagne oben auswählen → anrufen → Ergebnis klicken. Bei „Infos schicken“ geht die Mail automatisch raus, Follow-up inklusive.
5. **Versand** zeigt Tageslimit, Warm-up pro Postfach, eingegangene Antworten/Bounces und das Log

Ohne IMAP-Daten setzt ihr Antworten im Tab *Leads* manuell auf `replied`.

Ohne `DRY_RUN=false` wird nichts wirklich verschickt.

## Damit ihr nicht abgemahnt oder geblacklistet werdet

### Rechtlich (Deutschland)

- **§7 Abs. 2 Nr. 2 UWG**: Werbe-E-Mails brauchen eine *vorherige ausdrückliche Einwilligung*, **auch im B2B-Bereich**. „Mutmaßliches Interesse“ reicht bei E-Mails nicht (anders als beim Telefon). Kalte Werbe-Mails an Firmen können abgemahnt werden (Abmahnkosten, Unterlassungserklärung, Vertragsstrafe bei Wiederholung).
- **B2B-Telefonakquise** ist bei *mutmaßlicher Einwilligung* erlaubt (§7 Abs. 2 Nr. 1 UWG). Eine Firma ohne Website, der ihr eine Website anbietet, ist ein typischer Fall dafür.
- **Briefe** sind ohne Einwilligung zulässig.
- **DSGVO**: Firmendaten aus öffentlichen Quellen dürft ihr auf Basis des berechtigten Interesses (Art. 6 Abs. 1 f) verarbeiten. Bei der ersten Kontaktaufnahme müsst ihr informieren (Art. 14), Widersprüche sofort umsetzen (macht die Sperrliste).

Deshalb gilt standardmäßig `ALLOW_COLD_EMAIL=false`: E-Mails gehen nur an Leads mit Rechtsgrundlage
(`inquiry` = hat angefragt, `consent` = Opt-in, `customer` = Bestandskunde nach §7 Abs. 3 UWG).
Kalte Leads exportiert ihr als CSV, ruft an oder schreibt einen Brief. Sagt jemand „schicken Sie mir was“, setzt ihr den Lead auf `inquiry`, und ab dann übernimmt das Tool die Mails und Follow-ups.

`ALLOW_COLD_EMAIL=true` schaltet die Sperre ab. Dann tragt ihr das Abmahnrisiko. Das ist keine Rechtsberatung, im Zweifel klärt das mit einem Anwalt für Wettbewerbsrecht.

### Technisch (Zustellbarkeit)

- **Eigene Outreach-Domain** (z. B. `hk-growth-mail.de`) mit SPF, DKIM und DMARC, damit die Hauptdomain sauber bleibt.
- **Warm-up ist eingebaut**: Jedes Postfach startet mit 20 Mails am Tag und steigert sich pro Versandtag um 25 % bis zu seinem `dailyLimit`.
  **1000 Mails am Tag** heißt realistisch 7–10 Postfächer mit je 100–150 Mails und ca. 3 Wochen Anlauf. Ein einzelnes Postfach mit 1000 Mails am Tag landet sofort im Spam.
- Zufällige Pausen (45–120 s), Versand nur Mo–Fr von 8 bis 17 Uhr.
- Hard-Bounces (5xx) werden automatisch gesperrt. Über 5 % Fehler pausiert die Kampagne automatisch.
- Jede Mail ist reiner Text, hat Impressum, Abmeldelink und `List-Unsubscribe` als One-Click-Header (Pflicht bei Gmail/Yahoo).

## Struktur

| Datei | Zweck |
|---|---|
| `lib/leads.mjs` | OSM/Overpass-Abfrage, Branchen-Presets |
| `lib/enrich.mjs` | Website-Check + E-Mail aus Impressum |
| `lib/template.mjs` | Platzhalter, Footer, Abmelde-Header |
| `lib/scheduler.mjs` | Versand-Loop: Fenster, Warm-up, Limits, Bounces, Follow-ups, 3 Versuche bei SMTP-Störungen |
| `lib/inbox.mjs` | IMAP: Antworten, Bounces, Abwesenheitsnotizen erkennen (nur lesend) |
| `lib/db.mjs` | SQLite (Node-intern, keine extra Abhängigkeit) |
| `server.mjs` | API + Login + öffentliche Abmeldeseite `/u/:token` |
| `public/` | Oberfläche |
