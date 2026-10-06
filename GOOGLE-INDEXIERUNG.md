# Google-Indexierung: alle HK-Growth-Seiten unter einer Marke

Stand: 6. Oktober 2026, 23 Uhr. Gilt für hk-growthoperator.de, dealuno.hk-growthoperator.de,
dealoperator.hk-growthoperator.de und website.hk-growthoperator.de. luiskummer.de bleibt auf
Wunsch außen vor (nur die gemeinsame Organisation in den Daten ist gesetzt).

## Kurzfassung

- **Ein Profil reicht.** In der Google Search Console deckt eine einzige
  **Domain-Property `hk-growthoperator.de`** alle Subdomains ab (DealUno, Deal Operator,
  Webstudio, www, http und https). luiskummer.de bekommt eine zweite Property im selben
  Google-Konto. Kein einzelnes Profil pro Seite nötig.
- **Das Google Unternehmensprofil** (Maps, Knowledge Panel) hat genau eine Website-Adresse:
  `https://hk-growthoperator.de`. Die Marken kommen dort als **Produkte** mit eigenem Link
  hinein, nicht als weitere Profile.
- **Damit Google die Seiten als eine Gruppe erkennt**, publizieren jetzt alle fünf Seiten
  dieselbe Organisation in den strukturierten Daten
  (`https://hk-growthoperator.de/#organization`), und die Hauptseite verlinkt jede Marke
  im Footer. Bisher kannte Google den Zusammenhang nur aus dem Domainnamen.
- **Ob Google die Seiten „untereinander“ zeigt** (Sitelinks unter dem Haupttreffer),
  entscheidet Google selbst. Beeinflussbar sind nur die Voraussetzungen: saubere
  Struktur, Verlinkung, eindeutige Marke, Suchvolumen für den Markennamen.

## Stand 6. Oktober: erledigt, offen, blockiert

Erledigt (automatisch über das Dienstkonto `search-console-agent@hk-growth-seo`):

| Punkt | Ergebnis |
| --- | --- |
| Domain-Property `sc-domain:hk-growthoperator.de` | per DNS-TXT verifiziert, Dienstkonto ist Inhaber |
| Sitemaps | alle vier eingereicht; Hauptseite 9 URLs gelesen, DealUno 19 URLs gelesen, Deal Operator und Webstudio noch „ausstehend“ |
| URL-Prüfung | Startseite ist indexiert (letzter Crawl 2. Oktober, noch ohne Rich Results); Subdomains „Google nicht bekannt“, Crawl folgt über die Sitemaps |
| IndexNow (Bing, Copilot, ChatGPT-Suche) | Schlüssel `bc49fe1dfd860a2c09d72ac982f0768e` auf allen vier Hosts, alle Sitemap-URLs eingereicht, viermal `202 Accepted` |
| Live-Prüfung | alle 37 Sitemap-URLs antworten mit 200, JSON-LD mit gemeinsamer Organisation auf allen Startseiten |
| www | Express leitet `www.` per 301 auf die Hauptdomain (greift, sobald die www-Domain in Coolify ein Zertifikat hat) |
| DNS | Netlify-Eintrag gelöscht; `hk-growthoperator.de` zeigt seit dem Abend nur noch auf Hetzner, alle Aufrufe erreichen die neue Seite |
| Neue Seiten | 48 Seiten zu Suchbegriffen, Regionen, Branchen und Wettbewerbern: 12 Webstudio, 10 Hauptseite, 15 DealUno, 1 Deal Operator; alle in den Sitemaps, erneut eingereicht und an IndexNow gemeldet. Zuordnung in `SEO-KEYWORDS.md` |
| KI-Paket | Glossare mit DefinedTermSet auf Hauptseite, DealUno und Webstudio; `llms-full.txt` mit Volltext auf allen vier Sites; robots.txt mit ausdrücklicher Erlaubnis für KI-Crawler; Article-Daten mit Autor, Datum und „Kurz gesagt“ auf den Ratgeber- und Prozessseiten; Robots-Meta erlaubt volle Snippets. Details in `SEO-KEYWORDS.md`, Abschnitt 5 |

Blockiert, weil DNS oder Zugänge fehlen:

1. **Zwei A-Einträge auf der Hauptdomain.** Erledigt am 6. Oktober abends; nur noch Hetzner.
2. **www ohne Zertifikat.** `www.hk-growthoperator.de` zeigt auf Hetzner, aber der Dienst in
   Coolify kennt die Domain nicht. Domain im Coolify-Dienst der Hauptseite ergänzen.
3. **Search Console für Menschen.** Das Dienstkonto ist Inhaber. Ein zweiter Inhaber braucht
   ein echtes Google-Konto; `l.kummer@hk-growthoperator.de` ist keines (Google: „Could not
   resolve the email address“). Sobald eine Gmail- oder Workspace-Adresse vorliegt, trägt
   `gsa/setup.py` sie als Inhaber ein, alternativ in der Search Console unter Einstellungen →
   Nutzer und Berechtigungen.
4. **Unternehmensprofil.** Nicht per API möglich (Freigabe fehlt). Alle Texte stehen in
   `GOOGLE-UNTERNEHMENSPROFIL.md`, reines Einfügen.
5. **Dienstkonto-Schlüssel** `461d7e06…` nach Abschluss in der Cloud Console löschen; er war
   im Chat sichtbar. Die Domain-Verifizierung bleibt davon unberührt.

## Befund vor den Änderungen

| Seite | Live | robots.txt | sitemap.xml | Strukturierte Daten | Link zur Hauptseite | Von der Hauptseite verlinkt |
| --- | --- | --- | --- | --- | --- | --- |
| hk-growthoperator.de | ja | ja | ja (.html-URLs) | keine | – | – |
| dealuno.hk-growthoperator.de | ja | **404** | **404** | keine | nein | **nein** |
| dealoperator.hk-growthoperator.de | ja | **404** | **404** | keine, kein Canonical | nein | **nein** |
| website.hk-growthoperator.de | ja | ja | ja | ja, aber eigene Firma | ja | **nein** |
| luiskummer.de | ja | ja | ja | ja (Person) | ja | **nein** |

Zwei Dinge haben am meisten gefehlt: Die Hauptseite hat keine einzige Marke verlinkt, und
zwei der drei Subdomains waren für Google ohne Sitemap und robots.txt praktisch unsichtbar.
Dazu kam ein Tippfehler im Webstudio-Repo: Standard-Domain `webseite.hkgrowthoperator.de`
(ohne Bindestrich), eine Domain, die der Firma nicht gehört.

## Drei Dinge, die bei Google „Profil“ heißen

### 1. Google Unternehmensprofil (Business Profile)

Ein Standort, ein Profil. Mehrere Websites lassen sich dort nicht hinterlegen, aber:

- **Website:** `https://hk-growthoperator.de`
- **Termin-Link:** `https://website.hk-growthoperator.de/#termin` oder die DealUno-Demo
- **Produkte** (eigener Bereich im Profil, jedes mit Bild, Text und Button-Link):
  - DealUno: Sales-App & CRM für die Kaltakquise → `https://dealuno.hk-growthoperator.de/`
  - Deal Operator: kostenfreie Sales-Community → `https://dealoperator.hk-growthoperator.de/`
  - HK Growth Webstudio: Websites mit SEO und Anfrage-Automation → `https://website.hk-growthoperator.de/`
  - HK Growth OS: Prozessautomatisierung von der Anfrage bis zur Rechnung → `https://hk-growthoperator.de/system`
- **Beschreibung:** alle vier Marken namentlich nennen.
- **Name, Adresse, Telefon** exakt wie im Impressum (Weststraße 2, 51709 Marienheide,
  +49 175 4547011). Diese Angaben stehen jetzt identisch in den strukturierten Daten der
  Hauptseite.

### 2. Google Search Console (Indexierung)

Hier entsteht das „eine Profil“, das gewünscht ist:

1. Property-Typ **Domain** wählen, `hk-growthoperator.de` eintragen.
2. Den angezeigten **TXT-Eintrag** beim DNS-Anbieter der Domain anlegen (dort, wo die
   A-Records für dealuno./dealoperator. liegen).
3. Damit sind alle Subdomains in einer Property. Im Bericht „Leistung“ lässt sich nach
   Seite filtern (`dealuno.`, `dealoperator.` …), um die Marken einzeln zu sehen.
4. `luiskummer.de` als zweite Domain-Property anlegen (anderes Hauptdomain, gleiche
   Vorgehensweise).

### 3. Knowledge Panel / Marken-Entität

Google baut aus allen Signalen eine „Entität“ HK Growth. Dafür zählen: dieselbe
Organisation in den strukturierten Daten aller Seiten (jetzt umgesetzt), konsistente
Angaben zu Name/Adresse/Telefon, das Unternehmensprofil, Instagram/LinkedIn mit Link auf
die Hauptseite, Erwähnungen auf fremden Seiten.

## Wer soll für welche Suchbegriffe gefunden werden

| Seite | Suchbegriffe | Jetzt umgesetzt | Noch zu tun (Inhalt) |
| --- | --- | --- | --- |
| hk-growthoperator.de | Prozessautomatisierung Mittelstand, KI-Betriebssystem, Auftragssteuerung, von der Anfrage bis zur Rechnung | Titel/Beschreibung vorhanden; Organisation, Marken und Produkte als strukturierte Daten; Footer-Links | Ein Abschnitt „Unsere Marken“ auf `/unternehmen` mit je einem Absatz und Link zu DealUno, Deal Operator, Webstudio. Footer-Links allein sind ein schwaches Signal. |
| dealuno.hk-growthoperator.de | CRM, Sales-App, Kaltakquise Software, Vertriebssoftware, Power Dialer, Lead Score, Opener Setter Closer | Seitentitel und Beschreibungen nennen die Begriffe; SoftwareApplication-Daten mit Funktionen und Stichwörtern | Für generische Begriffe wie „CRM“ oder „Sales App“ braucht es eigene Inhaltsseiten (z. B. „Power Dialer für die Kaltakquise“, „CRM für Opener, Setter und Closer“, Vergleich, FAQ). Produktseiten allein ranken dafür nicht. |
| dealoperator.hk-growthoperator.de | Sales-Community, Cold-Calling-Community, gemeinsam callen, Kaltakquise Rangliste | Titel/Beschreibung, WebApplication-Daten (kostenfrei) | „So funktioniert’s“ ist die einzige Textseite. Ein kurzer öffentlicher Text „Für wen ist Deal Operator“ hilft. |
| website.hk-growthoperator.de | Webdesign Marienheide, Gummersbach, Oberberg, Köln; Website erstellen lassen | Live, Sitemap eingereicht, FAQ, Angebote und Referenzen vorhanden | Referenzen mit Zahlen ergänzen; Kunden-Websites mit Footer-Link zurück. |
| luiskummer.de | Luis Kummer, Luis Kummer HK Growth, Luis Kummer DealUno | Person-Daten mit Verweis auf die HK-Growth-Organisation | nichts Dringendes |

## Was in diesem Branch geändert wurde

Branch in allen Repos: `claude/google-indexierung-domains-t5t7cd`.

**HKGrowthOperator/Website** (hk-growthoperator.de)

- Canonicals auf allen Seiten absolut und auf die sauberen URLs (`/system` statt
  `system.html`). Der Spiegel-Workflow hatte sie relativ gemacht.
- Strukturierte Daten auf jeder indexierbaren Seite: Organisation mit Adresse, Gründern,
  Marken und Produkten (DealUno, Deal Operator, Webstudio, HK Growth OS), WebSite, WebPage,
  Breadcrumbs. Die Organisation hat die @id `https://hk-growthoperator.de/#organization`.
- Footer: Spalte „Unternehmen“ verlinkt DealUno, Deal Operator und Webstudio auf jeder Seite.
- Sitemap mit sauberen URLs und `lastmod`.
- Server: `/system.html`, `/index.html` usw. leiten mit 301 auf die saubere URL um;
  Danke-Seiten der Formulare ebenfalls ohne `.html`.
- `og:site_name` auf der Startseite.

**HKGrowthOperator/deal-Uno** (dealuno.hk-growthoperator.de)

- `robots.txt` und `sitemap.xml` (8 Seiten; `/starten/` und `/api/` ausgeschlossen),
  Server liefert `.xml`/`.txt` mit korrektem Typ.
- Auf jeder öffentlichen Seite: robots-Meta, hreflang, Open Graph mit absolutem Bild,
  JSON-LD (SoftwareApplication DealUno, Marke, WebSite, WebPage, Breadcrumbs), alles an die
  HK-Growth-Organisation gehängt.
- Titel und Beschreibungen der Produktseiten nennen CRM, Sales-App, Kaltakquise,
  Power Dialer, Lead Score, Opener/Setter/Closer.
- Footer-Link „HK Growth“ auf die Hauptseite.

**HKGrowthOperator/Dealoperator** (dealoperator.hk-growthoperator.de)

- `app/robots.ts`, `app/sitemap.ts`, `lib/site.ts` (Domain aus `APP_URL`, Fallback
  Produktivdomain).
- Root-Layout: `metadataBase`, suchorientierter Titel und Beschreibung, Open Graph und
  Twitter-Karte, JSON-LD (WebApplication kostenfrei, Marke, WebSite, HK-Growth-Organisation).
- Canonicals auf `/`, `/so-funktionierts`, `/starten`, `/anmelden`, Impressum, Datenschutz;
  `/ranking` zeigt per Canonical auf `/`.
- Persönlicher Bereich per robots.txt aus dem Index.
- Footer: ein Link „HK Growth“.
- Geprüft: Lint, Typecheck, 262 Tests, `next build`, Smoke-Test.

**HKGrowthOperator/WEBSEITE** (website.hk-growthoperator.de)

- Standard-Domain korrigiert: `website.hk-growthoperator.de` (Code, `.env.example`,
  README, Launch-Checkliste). In Coolify `SITE_URL` prüfen.
- Strukturierte Daten: Das Webstudio heißt jetzt „HK Growth Webstudio“ mit der UG als
  `legalName` und `parentOrganization` auf die HK-Growth-Organisation.

**HKGrowthOperator/Luiskummer** (luiskummer.de)

- `worksFor` der Person trägt die @id der HK-Growth-Organisation.

## SEO/GEO-Inhalte in diesem Branch

Technik allein bringt keine Rankings für „CRM“ oder „Kaltakquise Software“. Dafür braucht
es Seiten, die genau diese Fragen beantworten. Das ist jetzt angelegt:

**DealUno, fünf Ratgeberseiten** im Layout der Produktseiten, jede mit Hero, Erklärtext,
drei Funktionskarten, Paket-Hinweis, FAQ (als FAQPage-Daten für Google und KI-Suchen) und
Demo-Anfrage als Ziel:

| Seite | Suchbegriffe |
| --- | --- |
| `/kaltakquise-software/` | Kaltakquise Software, Telefonakquise Software, B2B Kaltakquise Tool |
| `/crm-fuer-vertriebsteams/` | CRM Vertrieb, Sales CRM, CRM Kaltakquise, CRM Opener Setter Closer |
| `/sales-app/` | Sales App, Vertriebs-App, Vertriebssoftware |
| `/power-dialer/` | Power Dialer, Dialer Software, Telefonakquise Tool |
| `/lead-scoring/` | Lead Scoring, Lead Score, B2B Leads finden, Leadrecherche |
| `/vertriebssoftware-kmu/` | Vertriebssoftware KMU, Vertriebssoftware kleine Unternehmen |
| `/kaltakquise-software-vergleich/` | Kaltakquise Software Vergleich, CRM oder Dialer, Alternative zu Excel |
| `/kaltakquise-skript/` | Kaltakquise Skript, Telefonakquise Skript, Gesprächsleitfaden |
| `/einwandbehandlung-telefonakquise/` | Einwandbehandlung Telefonakquise, Einwände Kaltakquise |
| `/setter-closer-modell/` | Setter Closer, Opener Setter Closer, Vertriebsrollen |
| `/ratgeber/` | Übersicht aller Ratgeber, verlinkt im Footer jeder Seite |

Jede Seite verlinkt drei verwandte Ratgeber („Weiterlesen“), alle stehen in der Sitemap
und in `llms.txt`. Wettbewerber, Begriffe und die nächsten Seiten je Marke: `SEO-KEYWORDS.md`.

**Hauptseite:** Titel und Beschreibungen der sechs Seiten nennen die Suchbegriffe
(Prozessautomatisierung Mittelstand, Auftragssteuerung, Nachkalkulation, Rechnungsablauf,
KI-Betriebssystem, ROI-Rechner). `/unternehmen` hat einen Abschnitt „Vier Marken. Ein Team.“
mit Text und Link zu DealUno, Deal Operator und Webstudio. Die FAQ der Startseite ist als
FAQPage-Daten hinterlegt, `llms.txt` beschreibt Firma und Marken für KI-Suchen.

**Deal Operator:** `llms.txt`.

### Was danach Rankings und Anfragen bringt

1. **Monatlich eine neue Ratgeberseite auf DealUno.** Kandidaten: „Kaltakquise Skript
   B2B“, „Einwandbehandlung Telefonakquise“, „Setter Closer Modell“, „Vorzimmer
   Kaltakquise“, „Nachfassen nach dem Erstgespräch“. Jede Seite mit FAQ und Demo-CTA.
2. **Erfahrungsberichte und Zahlen.** Ein Kundenbeispiel mit echten Werten (Anwahlen,
   Termine, Abschlussquote) auf DealUno und als Beitrag im Unternehmensprofil.
3. **Google-Bewertungen** im Unternehmensprofil sammeln; nach jedem abgeschlossenen
   Projekt eine Bitte um Bewertung mit Direktlink.
4. **Backlinks:** Deal-Operator-Mitglieder und Webstudio-Kunden verlinken auf
   hk-growthoperator.de (Footer „Website von HK Growth Webstudio“), Branchenverzeichnisse
   für Marienheide/Oberberg, Gastbeiträge in Vertriebs-Communities.
5. **Bing Webmaster Tools** einrichten; Bing speist ChatGPT-Suche und Copilot.
6. **Search Console monatlich lesen:** Welche Anfragen bringen Impressionen ohne Klicks?
   Dort Titel und Beschreibung nachschärfen oder eine eigene Seite anlegen.

## Nach dem Deploy: Reihenfolge

1. **Branches mergen und deployen** (Coolify), danach je Seite prüfen:
   `/robots.txt`, `/sitemap.xml`, Startseite im Quelltext auf `application/ld+json`.
2. **Webstudio-Host:** Die Seite läuft unter `website.hk-growthoperator.de` auf Hetzner und
   ist erreichbar. Der Eintrag `webseite.hk-growthoperator.de` bei All-Inkl zeigt auf einen
   leeren Webspace und kann im KAS gelöscht werden, damit keine zweite, leere Adresse existiert.
3. **Search Console:** erledigt (Domain-Property verifiziert, Dienstkonto ist Inhaber).
4. **Sitemaps einreichen:** erledigt, alle vier in der Domain-Property.
5. **URL-Prüfung:** per API gelaufen. „Indexierung beantragen“ gibt es nur in der
   Web-Oberfläche; sobald ein Google-Konto Inhaber ist, für die vier Startseiten und
   `/ratgeber/` auslösen.
6. **Rich-Results-Test** (search.google.com/test/rich-results) mit den fünf Startseiten:
   Organisation, SoftwareApplication, WebSite müssen ohne Fehler lesbar sein. Warnungen zu
   fehlenden Preisen sind erwartbar und unkritisch.
7. **Unternehmensprofil** wie oben: Website, Termin-Link, vier Produkte, Beschreibung,
   Kategorie prüfen (z. B. „Softwareunternehmen“ oder „Unternehmensberatung“, Zweitkategorie
   „Webdesigner“).
8. **Bing:** IndexNow ist eingerichtet und alle URLs sind gemeldet. Bing Webmaster Tools
   (Import aus der Search Console) ergänzt Berichte, ist aber kein Muss mehr.
9. **Instagram und LinkedIn:** Website-Feld auf `https://hk-growthoperator.de`, die Marken
   in der Bio nennen.
10. **Nach 2 bis 4 Wochen:** Search Console → Leistung → Filter „Seite enthält
    `dealuno.`“ usw. Abdeckung: alle Sitemap-URLs sollten „Indexiert“ sein. Suchanfragen
    für „HK Growth Operator“ und die Markennamen beobachten.

## Offene Punkte und Risiken

- **Spiegel-Workflow im Website-Repo** (`.github/workflows/mirror-live-site.yml`) würde
  `site/` komplett mit einem wget-Abzug der Live-Seite überschreiben und die Canonicals
  wieder relativ machen. Nicht mehr manuell starten oder vorher anpassen.
- **`www.hk-growthoperator.de`** löst inzwischen auf Hetzner auf; der 301 auf die Hauptdomain
  ist im Server. Es fehlt nur das Zertifikat (www-Domain im Coolify-Dienst eintragen).
- **Webstudio-Dockerfile** kopiert Module einzeln. Neue `.mjs`-Dateien müssen in die `COPY`-Zeile,
  sonst startet der neue Container nicht und Coolify lässt still den alten laufen (so geschehen bei
  `landing-data.mjs`, behoben). Ein Test im Repo prüft das jetzt.
- **Bisher indexierte `.html`-Adressen** der Hauptseite leiten jetzt um. Die Search Console
  meldet sie als „Seite mit Weiterleitung“; das ist korrekt, die Signale wandern mit.
- **Deal Operator Footer** hat bewusst nur einen zusätzlichen Link bekommen, weil die
  Fußzeile am 28.09. absichtlich auf vier Einträge reduziert wurde.
- **DealUno `nginx.conf`** wird nicht benutzt (das Dockerfile startet den Node-Server), die
  dort eingetragene Open-Graph-Injektion war deshalb nie aktiv. Open Graph steht jetzt im HTML.
- **Zeithorizont:** Indexierung neuer Sitemaps dauert Tage bis zwei Wochen. Sitelinks und
  ein Knowledge Panel brauchen Wochen bis Monate und hängen am Suchvolumen für den
  Markennamen. Für generische Begriffe (CRM, Sales App) entscheidet der Inhalt, nicht die
  Technik; die Technik ist jetzt die Voraussetzung.
