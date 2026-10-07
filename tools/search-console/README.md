# Search-Console-Skripte

Alle Skripte laufen mit dem JSON-Schlüssel des Dienstkontos `search-console-agent@hk-growth-seo`
(nie ins Repo legen; `.gitignore` schließt `*.json`, `sa.pem`, `token.txt` aus). Aufruf immer
mit `python3 -I`, der Schlüsselpfad ist das erste Argument.

| Skript | Zweck |
| --- | --- |
| `token.py <key>` | Access-Token für das Dienstkonto (wird von den anderen Skripten aufgerufen) |
| `setup.py <key> <email>` | Domain-Property verifizieren, Inhaber eintragen, Sitemaps einreichen, Startseiten prüfen |
| `properties.py <key>` | je Site eine URL-Präfix-Property anlegen und deren Sitemap einreichen |
| `owner.py <key> <email>` | ein Google-Konto als Inhaber auf allen fünf Properties eintragen |
| `resubmit.py <key>` | alle vier Sitemaps neu einreichen, Status und Indexstand der Startseiten zeigen |
| `pull.py <key>` | Suchanfragen der letzten 90 Tage und Indexstatus aller Sitemap-URLs nach `gsc-data.json` |

Stand 7. Oktober 2026: Domain-Property `sc-domain:hk-growthoperator.de` plus vier Einzel-Properties
(`https://hk-growthoperator.de/`, `https://dealuno.…/`, `https://dealoperator.…/`,
`https://website.…/`), alle mit dem Dienstkonto als Inhaber.
