# Tracking: Meta-Pixel, Conversions API und Google Ads auf allen vier Sites

Stand: 7. Oktober 2026. Alle vier Sites haben dasselbe Einwilligungs-Skript. Ohne Einwilligung
lädt nichts, ohne gesetzte IDs erscheint nicht einmal der Banner. Das ist in Deutschland die
einzige zulässige Form (§ 25 TDDDG, Art. 6 Abs. 1 lit. a DSGVO); ein Pixel ohne Banner wäre
abmahnfähig und würde Meta-Daten liefern, die Meta bei einer Prüfung selbst sperrt.

## Was wo eingetragen werden muss (Coolify → Dienst → Environment Variables)

| Site | Variablen | Wirkung |
| --- | --- | --- |
| hk-growthoperator.de | `META_PIXEL_ID`, `GOOGLE_ADS_ID`, `META_CAPI_TOKEN`, optional `GOOGLE_ADS_CONVERSIONS`, `META_TEST_EVENT_CODE` | Banner, Pixel, Google-Tag; Formulare senden Lead-Ereignisse serverseitig |
| dealuno.hk-growthoperator.de | `META_PIXEL_ID`, `GOOGLE_ADS_ID`, optional `GOOGLE_ADS_CONVERSIONS` | Banner, Pixel, Google-Tag; Schedule, InitiateCheckout, Purchase |
| website.hk-growthoperator.de | `META_PIXEL_ID`, `GOOGLE_ADS_ID`, `META_CAPI_TOKEN`, optional `GOOGLE_ADS_CONVERSIONS` | Banner, Pixel, Google-Tag; Anfragen senden Lead-Ereignisse serverseitig |
| dealoperator.hk-growthoperator.de | `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID` | Banner, Pixel, Google-Tag; CompleteRegistration auf /bestaetigen |

- **Ein Pixel für alle vier Sites.** Meta ordnet Ereignisse pro Pixel zu; mit einer Pixel-ID für
  die Gruppe laufen alle Zielgruppen und Konversionen in einem Topf, Kampagnen je Marke werden
  über Ereignisse und URLs getrennt. Pixel-ID: Meta Events Manager → Datenquellen → Pixel.
- **Conversions-API-Token:** Events Manager → Einstellungen → Conversions API → „Zugriffsschlüssel
  generieren“. Nur in Coolify eintragen, nie ins Repo, nie in den Chat.
- **Google Ads ID** (`AW-123456789`): Google Ads → Tools → Konversionen → Tag einrichten.
  Konversionsaktionen mit Label als JSON in `GOOGLE_ADS_CONVERSIONS`, zum Beispiel
  `{"Lead":"AW-123456789/AbCdEf","Purchase":"AW-123456789/GhIjKl"}`.
- **Testen:** `META_TEST_EVENT_CODE` aus dem Events Manager („Testereignisse“) setzen, Seite
  aufrufen, „Alle akzeptieren“, Formular absenden; im Events Manager erscheinen PageView und Lead,
  der Lead einmal vom Browser und einmal vom Server mit derselben Ereignis-ID (dedupliziert).
  Danach den Testcode wieder entfernen.

## Was gemessen wird

| Ereignis | Wo | Auslöser |
| --- | --- | --- |
| PageView | alle Seiten | nach Einwilligung |
| Lead | Hauptseite Danke-Seiten, Webstudio nach erfolgreicher Anfrage | Formular abgeschickt; Browser und Conversions API mit derselben Ereignis-ID |
| Contact | alle Seiten | Klick auf Telefonnummer oder E-Mail-Adresse |
| Schedule | DealUno | Klick auf „Kostenfreie Demo anfragen“ |
| InitiateCheckout | DealUno | Klick auf „Jetzt kaufen“ / „Direkt kaufen“ |
| Purchase | DealUno | Aufruf der Buchungsbestätigung `/starten/bestaetigung/` |
| CompleteRegistration | Deal Operator | Aufruf von `/bestaetigen` nach der Anmeldung |
| beliebig | alle Seiten | `data-track="Name"` an einem Link oder Button, oder `document.dispatchEvent(new CustomEvent("hk:track", { detail: { name, params } }))` |

Google erhält dieselben Ereignisse als `gtag("event", …)`; mit Labels in `GOOGLE_ADS_CONVERSIONS`
zusätzlich als Konversion. Consent Mode v2 ist vor der Einwilligung auf „denied“ gesetzt und
wird nach der Einwilligung auf „granted“ aktualisiert.

## Conversions API (Server-Ereignisse)

Hauptseite (`/api/forms/*`) und Webstudio (`/api/leads`) senden bei vorliegender Einwilligung
(Cookie `hk_consent`) ein Lead-Ereignis an `graph.facebook.com/v21.0/<pixel>/events` mit
E-Mail und Telefon als SHA-256-Hash, Vorname gehasht, IP, Browserkennung, `_fbp`/`_fbc` und der
Ereignis-ID, die auch der Browser verwendet. Das hebt die Ereignis-Übereinstimmungsqualität
(Event Match Quality) und fängt Ereignisse auf, die Adblocker im Browser verhindern. Code:
`meta-capi.mjs` in beiden Repos.

## Einwilligung

- Banner mit „Alle akzeptieren“ und „Nur notwendige“, Link zur Datenschutzerklärung.
- Entscheidung sechs Monate in `localStorage` und Cookie `hk_consent`.
- Widerruf jederzeit über „Cookie-Einstellungen“ im Footer (`data-consent-open`).
- Datenschutzerklärungen aller vier Sites haben einen Abschnitt zu Meta-Pixel, Conversions API
  und Google Ads; bitte einmal juristisch gegenlesen lassen.

## Grenzen

- Mehr Tracking als das bringt keine bessere Anzeigenleistung, sondern Sperrungen: Meta lehnt
  Ereignisse ohne Einwilligungssignal in der EU zunehmend ab, Google wertet Daten ohne Consent
  Mode nicht für Gebote.
- Die Einwilligungsquote liegt typisch bei 50 bis 70 Prozent. Die Conversions API gleicht einen
  Teil aus, aber nicht alles.
- Erst mit Pixel-ID und Ads-ID in Coolify passiert etwas. Bis dahin sind die Sites unverändert
  ohne Cookies.
