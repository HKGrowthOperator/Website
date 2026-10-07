# Search-Console-Einrichtung für die HK-Growth-Domains über das Dienstkonto.
# Aufruf: python3 -I setup.py <key.json> <inhaber-email> [--check-only]
import json, sys, urllib.request, urllib.parse, subprocess, os
KEY, OWNER = sys.argv[1], sys.argv[2]
CHECK_ONLY = "--check-only" in sys.argv
FORCE = "--force" in sys.argv
ONLY = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
HERE = os.path.dirname(os.path.abspath(__file__))
DOMAINS = {
    "hk-growthoperator.de": {
        "token": "google-site-verification=aYjAmT5kdP3HCbnNASZp5CZjGNh96cmejkJPk4VfuK0",
        "sitemaps": [
            "https://hk-growthoperator.de/sitemap.xml",
            "https://dealuno.hk-growthoperator.de/sitemap.xml",
            "https://dealoperator.hk-growthoperator.de/sitemap.xml",
            "https://website.hk-growthoperator.de/sitemap.xml",
        ],
        "inspect": ["https://hk-growthoperator.de/", "https://dealuno.hk-growthoperator.de/", "https://dealoperator.hk-growthoperator.de/", "https://website.hk-growthoperator.de/"],
    },
    "luiskummer.de": {
        "token": "google-site-verification=tu64uMP50iGkT9dmD1Bh4fuIoJtBXncNYSxmkWZ0JoE",
        "sitemaps": ["https://luiskummer.de/sitemap.xml"],
        "inspect": ["https://luiskummer.de/"],
    },
}
SV = "https://www.googleapis.com/siteVerification/v1"
WM = "https://www.googleapis.com/webmasters/v3"
SC = "https://searchconsole.googleapis.com/v1"

def token():
    return subprocess.run(["python3", "-I", os.path.join(HERE, "token.py"), KEY], capture_output=True, text=True, check=True).stdout.strip()

def call(method, url, body=None, tok=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try: return e.code, json.loads(raw)
        except Exception: return e.code, {"raw": raw}

def dns_txt(domain):
    with urllib.request.urlopen(f"https://dns.google/resolve?name={domain}&type=TXT", timeout=20) as r:
        d = json.load(r)
    return [a["data"].strip('"') for a in d.get("Answer", [])]

tok = token()
for domain, cfg in DOMAINS.items():
    if ONLY and domain != ONLY:
        continue
    print(f"\n=== {domain} ===")
    records = dns_txt(domain)
    visible = any(cfg["token"] in rec for rec in records)
    print("TXT sichtbar:", visible)
    if (not visible and not FORCE) or CHECK_ONLY:
        continue
    site = {"site": {"type": "INET_DOMAIN", "identifier": domain}}
    code, res = call("POST", f"{SV}/webResource?verificationMethod=DNS_TXT", site, tok)
    print("verify:", code, res.get("id") or res)
    if code != 200:
        continue
    rid = res["id"]
    owners = sorted(set(res.get("owners", []) + [OWNER]))
    code, res = call("PUT", f"{SV}/webResource/{urllib.parse.quote(rid, safe='')}", {**site, "id": rid, "owners": owners}, tok)
    print("owners:", code, res.get("owners") or res)
    prop = f"sc-domain:{domain}"
    code, res = call("PUT", f"{WM}/sites/{urllib.parse.quote(prop, safe='')}", None, tok)
    print("property:", code, res or "ok")
    for sm in cfg["sitemaps"]:
        code, res = call("PUT", f"{WM}/sites/{urllib.parse.quote(prop, safe='')}/sitemaps/{urllib.parse.quote(sm, safe='')}", None, tok)
        print("sitemap:", code, sm, res or "ok")
    for url in cfg["inspect"]:
        code, res = call("POST", f"{SC}/urlInspection/index:inspect", {"inspectionUrl": url, "siteUrl": prop, "languageCode": "de"}, tok)
        st = res.get("inspectionResult", {}).get("indexStatusResult", {})
        print("inspect:", code, url, st.get("verdict"), st.get("coverageState"), st.get("lastCrawlTime"))
print("\n--- Properties des Dienstkontos ---")
print(json.dumps(call("GET", f"{WM}/sites", None, tok)[1], indent=1, ensure_ascii=False))
