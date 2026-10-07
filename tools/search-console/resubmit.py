# Sitemaps der HK-Growth-Domain neu einreichen und Status abfragen. Aufruf: python3 -I resubmit.py <key.json>
import json, sys, urllib.request, urllib.parse, subprocess, os
KEY = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__))
WM = "https://www.googleapis.com/webmasters/v3"; SC = "https://searchconsole.googleapis.com/v1"
PROP = "sc-domain:hk-growthoperator.de"
SITEMAPS = ["https://hk-growthoperator.de/sitemap.xml", "https://dealuno.hk-growthoperator.de/sitemap.xml", "https://dealoperator.hk-growthoperator.de/sitemap.xml", "https://website.hk-growthoperator.de/sitemap.xml"]
tok = subprocess.run(["python3", "-I", os.path.join(HERE, "token.py"), KEY], capture_output=True, text=True, check=True).stdout.strip()
def call(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            raw = r.read(); return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try: return e.code, json.loads(raw)
        except Exception: return e.code, {"raw": raw}
p = urllib.parse.quote(PROP, safe="")
for sm in SITEMAPS:
    code, res = call("PUT", f"{WM}/sites/{p}/sitemaps/{urllib.parse.quote(sm, safe='')}")
    print("sitemap PUT:", code, sm, res or "ok")
code, res = call("GET", f"{WM}/sites/{p}/sitemaps")
for s in res.get("sitemap", []):
    c = s.get("contents", [{}])[0]
    print("status:", s["path"], "lastSubmitted", s.get("lastSubmitted"), "lastDownloaded", s.get("lastDownloaded"), "submitted", c.get("submitted"), "indexed", c.get("indexed"), "errors", s.get("errors"), "warnings", s.get("warnings"))
for url in ["https://hk-growthoperator.de/", "https://dealuno.hk-growthoperator.de/", "https://dealoperator.hk-growthoperator.de/", "https://website.hk-growthoperator.de/"]:
    code, res = call("POST", f"{SC}/urlInspection/index:inspect", {"inspectionUrl": url, "siteUrl": PROP, "languageCode": "de"})
    st = res.get("inspectionResult", {}).get("indexStatusResult", {})
    print("inspect:", code, url, st.get("verdict"), st.get("coverageState"), st.get("lastCrawlTime"))
