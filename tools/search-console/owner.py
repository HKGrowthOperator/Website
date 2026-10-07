# Trägt ein Google-Konto als Inhaber auf der Domain-Property und den vier Einzel-Properties ein.
# Aufruf: python3 -I owner.py <key.json> <google-konto-email>
import json, sys, urllib.request, urllib.parse, subprocess, os
KEY, OWNER = sys.argv[1], sys.argv[2]; HERE = os.path.dirname(os.path.abspath(__file__))
SV = "https://www.googleapis.com/siteVerification/v1"
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
code, res = call("GET", f"{SV}/webResource")
items = res.get("items", [])
print("verifizierte Ressourcen des Dienstkontos:", len(items))
for it in items:
    site = it["site"]; rid = it["id"]
    owners = sorted(set(it.get("owners", []) + [OWNER]))
    code, res = call("PUT", f"{SV}/webResource/{urllib.parse.quote(rid, safe='')}", {"id": rid, "site": site, "owners": owners})
    print(f"  {site['type']:12} {site['identifier']:45} -> {code} {res.get('owners') or res}")
