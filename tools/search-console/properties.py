# Legt je Site eine eigene URL-Präfix-Property an, reicht deren Sitemap ein und zeigt den Zugriff.
# Aufruf: python3 -I properties.py <key.json>
import json, sys, urllib.request, urllib.parse, subprocess, os
KEY = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__))
WM = "https://www.googleapis.com/webmasters/v3"
SITES = ["https://hk-growthoperator.de/", "https://dealuno.hk-growthoperator.de/", "https://dealoperator.hk-growthoperator.de/", "https://website.hk-growthoperator.de/"]
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
for s in SITES:
    q = urllib.parse.quote(s, safe="")
    code, res = call("PUT", f"{WM}/sites/{q}")
    print("property anlegen:", code, s, res or "ok")
    code, res = call("PUT", f"{WM}/sites/{q}/sitemaps/{urllib.parse.quote(s + 'sitemap.xml', safe='')}")
    print("  sitemap:", code, res or "ok")
print("\n--- alle Properties des Dienstkontos ---")
code, res = call("GET", f"{WM}/sites")
for e in sorted(res.get("siteEntry", []), key=lambda x: x["siteUrl"]):
    print(f"  {e['permissionLevel']:22} {e['siteUrl']}")
