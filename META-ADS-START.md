# Meta Ads: Start-Plan für Facebook und Instagram mit dem neuen Pixel

Stand: 7. Oktober 2026. Das Pixel, die Conversions API und die Ereignisse aus `TRACKING.md`
sind die Grundlage. Dieser Plan sagt, welche Kampagnen damit laufen, auf welche Ereignisse sie
optimieren, welche Zielgruppen das Pixel aufbaut und welche Texte in die Anzeigen kommen.

## Vorher im Meta Business Manager (einmalig, etwa 30 Minuten)

1. **Pixel anlegen:** Events Manager → Datenquellen → „Daten verknüpfen“ → Web. Ein Pixel für
   alle vier Sites. Die Pixel-ID in Coolify als `META_PIXEL_ID` (Deal Operator:
   `NEXT_PUBLIC_META_PIXEL_ID`) eintragen.
2. **Conversions API:** Events Manager → Einstellungen → Conversions API → Zugriffsschlüssel
   generieren → in Coolify als `META_CAPI_TOKEN` bei Hauptseite und Webstudio.
3. **Domain verifizieren:** Business-Einstellungen → Markensicherheit → Domains →
   `hk-growthoperator.de` → DNS-TXT-Eintrag bei All-Inkl setzen. Deckt alle Subdomains ab und
   ist Voraussetzung, um Konversionsereignisse zu priorisieren.
4. **Ereignisse prüfen:** Events Manager → Testereignisse → Site mit „Alle akzeptieren“
   aufrufen, Formular absenden. Erwartet: PageView, Lead (Browser und Server, dedupliziert),
   auf DealUno Schedule und InitiateCheckout, auf Deal Operator CompleteRegistration.
5. **Ereignisse priorisieren** (Aggregierte Ereignismessung): 1 Purchase, 2 Lead,
   3 Schedule, 4 InitiateCheckout, 5 CompleteRegistration, 6 Contact, 7 PageView.
6. **Werbekonto:** Rechnungsstellung hinterlegen, Zeitzone Berlin, Währung Euro.

## Zielgruppen aus dem Pixel (Zielgruppen → „Custom Audience“ → Website)

| Zielgruppe | Regel | Zweck |
| --- | --- | --- |
| Besucher DealUno 90 Tage | URL enthält `dealuno.hk-growthoperator.de` | Retargeting Sales-App |
| Besucher Webstudio 90 Tage | URL enthält `website.hk-growthoperator.de` | Retargeting Webdesign, lokal |
| Besucher HK Growth OS 90 Tage | URL enthält `hk-growthoperator.de/` ohne Subdomain | Retargeting Prozessautomatisierung |
| Besucher Deal Operator 30 Tage | URL enthält `dealoperator.` | Retargeting Community |
| Kaufinteresse DealUno | Ereignis InitiateCheckout oder Schedule, 30 Tage | heiße Zielgruppe, höheres Gebot |
| Leads 180 Tage | Ereignis Lead, Purchase, CompleteRegistration | ausschließen (schon konvertiert) |
| Lookalike Leads 1 % Deutschland | Quelle „Leads 180 Tage“, ab 100 Leads sinnvoll | Reichweite mit ähnlichen Personen |
| Lookalike Besucher 1 % Deutschland | Quelle „Besucher DealUno 90 Tage“ | Reichweite vor den ersten 100 Leads |

Die Zielgruppen füllen sich erst mit Besuchern nach Einwilligung. Rechnen Sie mit 50 bis
70 Prozent Einwilligungsquote; die Conversions API fängt einen Teil des Rests für Ereignisse,
nicht für Zielgruppen.

## Kampagnen, Reihenfolge nach Ertrag je Euro

| Nr. | Kampagne | Ziel | Optimiert auf | Tagesbudget |
| --- | --- | --- | --- | --- |
| 1 | Retargeting alle Marken | Leads | Lead | 8 € |
| 2 | DealUno Demo | Leads | Schedule, nach 50 Ereignissen Lead | 25 € |
| 3 | Webstudio lokal | Leads | Lead | 12 € |
| 4 | Deal Operator Community | Leads | CompleteRegistration | 6 € |
| 5 | HK Growth OS | Bekanntheit, später Leads | ThruPlay bei Video, sonst Landingpage-Aufrufe | 8 € |

Zusammen rund 59 € am Tag. Start mit 1 bis 3, nach zwei Wochen 4 und 5. Meta-Kampagnen
brauchen rund 50 Ereignisse je Woche und Anzeigengruppe, um stabil zu lernen; bis dahin
Anzeigengruppen zusammenlegen statt aufteilen.

### Kampagne 1: Retargeting alle Marken

Zielgruppe: alle vier Besucher-Zielgruppen, ausgeschlossen „Leads 180 Tage“. Platzierungen:
Advantage+. Je Marke eine Anzeige, deren Text an den Besuch anknüpft:

```
DealUno: „Noch am Überlegen? In 30 Minuten zeigen wir DealUno live an Ihren Leads: Lead Radar, Anrufsession mit Power Dialer, Übergabe an den Closer. Kostenfreie Demo.“ → https://dealuno.hk-growthoperator.de/#demo
Webstudio: „Ihre Website in 2–4 Wochen zum Festpreis, mit SEO, KI-Sichtbarkeit und Terminbuchung. Erstgespräch kostenlos.“ → https://website.hk-growthoperator.de/#termin
HK Growth OS: „Von der Anfrage bis zur Rechnung in einem Ablauf. Prozess-Check in 10 Minuten, kostenlos.“ → https://hk-growthoperator.de/#prozess-check
Deal Operator: „Gemeinsam callen statt allein. Kostenfreie Sales-Community mit Tagesabschluss, Serie und Rangliste.“ → https://dealoperator.hk-growthoperator.de/starten
```

### Kampagne 2: DealUno Demo

Zielgruppe: Deutschland, Österreich, Schweiz, 25 bis 55, Interessen „Vertrieb“, „Kaltakquise“,
„B2B-Marketing“, „CRM“, „Lead-Generierung“, Berufsbezeichnungen Vertriebsleiter, Sales Manager,
Geschäftsführer, Gründer; ab 100 Leads zusätzlich Lookalike 1 %. Ausschluss „Leads 180 Tage“.
Format: Video oder Bildschirmaufnahme der Anrufsession (15 bis 30 Sekunden) plus Karussell
(Lead Radar, Anrufsession, Vertriebsprozess, Pakete). Zielseite `/kaltakquise-software/` für
kalte Zielgruppen, `/#demo` für Lookalikes.

```
Primärtext: Kaltakquise ohne Zettelwirtschaft: DealUno findet passende Firmen (Lead Score 1–10), wählt mit Power Dialer, zeigt Skript und Einwände im Gespräch und übergibt sauber vom Opener an den Setter und Closer. Deutsche Sales-App, Daten auf EU-Servern, ab 2 Nutzern.
Überschrift: Sales-App & CRM für Kaltakquise | Beschreibung: Kostenfreie Demo mit persönlicher Einführung | Button: Mehr dazu
Varianten: „Pipedrive, Close oder Aircall? DealUno verbindet Leadrecherche, Dialer und CRM in einem.“ / „Wie viele Anwahlen bis zum Termin? Mit DealUno wissen Sie es je Rolle.“
```

### Kampagne 3: Webstudio lokal

Zielgruppe: Umkreis 40 km um Marienheide plus Köln, 28 bis 65, Interessen Kleinunternehmen,
Handwerk, Selbstständigkeit, Vereinsarbeit; Berufsbezeichnungen Inhaber, Geschäftsführer,
Vorstand. Format: Vorher-nachher-Karussell echter Projekte (Citroën Club Rhein-Ruhr, SC
Merzenich) und ein Bild „Festpreis, 2–4 Wochen“. Zielseiten `/webdesign-gummersbach`,
`/webdesign-koeln`, `/website-fuer-handwerker`, `/website-fuer-vereine` je nach Anzeige.

```
Primärtext: Webdesign aus Marienheide für Gummersbach, Oberberg und Köln: Unternehmenswebsite in 2–4 Wochen zum Festpreis statt nach Agenturstunden. Inklusive SEO, Sichtbarkeit in ChatGPT und Google, Terminbuchung und Anfrage-Automation. Erstgespräch kostenlos, 15 Minuten von Gummersbach.
Überschrift: Website zum Festpreis in 2–4 Wochen | Beschreibung: Für Handwerk, Praxen, Vereine, Dienstleister | Button: Termin buchen
```

### Kampagne 4: Deal Operator Community

Zielgruppe: Deutschland, 20 bis 45, Interessen Vertrieb, Kaltakquise, Telefonakquise, Setter,
Closer, Selbstständigkeit; Reels und Stories bevorzugt. Ziel `/starten`, Ereignis
CompleteRegistration auf `/bestaetigen`.

```
Primärtext: Allein callen ist hart. Deal Operator ist die kostenfreie Sales-Community: Zahlen je Calling-Tag eintragen, Serie aufbauen, Rangliste sehen, in der Discord-Runde Einwände und Vorzimmer besprechen. Ohne Testphase, ohne Paket, ohne Kosten.
Überschrift: Kostenfreie Sales-Community zum Callen | Button: Registrieren
```

### Kampagne 5: HK Growth OS

B2B-Entscheider im Mittelstand sind auf Meta teuer; die Kampagne baut Bekanntheit und füllt
die Retargeting-Zielgruppe. Zielgruppe: Deutschland, 35 bis 60, Berufsbezeichnungen
Geschäftsführer, Betriebsleiter, Inhaber, Branchen Handwerk, Bau, Maschinenbau, technischer
Service. Format: 30-Sekunden-Video „Anfrage → Angebot → Auftrag → Rechnung“. Zielseite
`/prozessautomatisierung`. Alternative mit besserer Trefferquote: LinkedIn-Anzeigen, dort
aber 8 bis 15 € je Klick.

## Konversionen und Messung

- Meta optimiert auf die Ereignisse aus der Priorisierung oben; Browser- und Server-Ereignisse
  tragen dieselbe Ereignis-ID, Meta zählt sie einmal.
- UTM-Parameter an jede Zielseite: `?utm_source=meta&utm_medium=paid&utm_campaign=<kampagne>&utm_content=<anzeige>`.
  Die Search Console zeigt sie nicht, aber die Formulare der Hauptseite und des Webstudios
  nehmen die Quelle mit in die Anfrage.
- Wöchentlich: Kosten je Lead je Kampagne, Einwilligungsquote (PageViews gegen Serverlogs),
  Ereignis-Übereinstimmungsqualität im Events Manager (Ziel über 6 von 10).
- Nach 30 Tagen: Anzeigen mit Kosten je Lead über dem Doppelten des Besten abschalten,
  Budget zur besten Kampagne, Lookalike aus Leads anlegen.

## Alternative mit weniger Reibung: Lead Ads mit Formular in Meta

Für DealUno und das Webstudio lassen sich zusätzlich Lead Ads mit Sofortformular schalten:
Das Formular öffnet sich in Facebook oder Instagram, Name, E-Mail und Telefon sind vorausgefüllt,
die Kosten je Lead liegen meist unter denen mit Website-Zielseite, die Lead-Qualität darunter.
Leads landen im Meta-Lead-Center und per Zapier, Make oder der Meta-Leads-API im CRM. Für den
Start empfehlen wir die Website-Zielseiten, weil sie den Besucher auch für Retargeting und
Google messbar machen.
