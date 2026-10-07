# Search-Console-Daten: Suchanfragen/Seiten der letzten 90 Tage und Indexstatus aller Sitemap-URLs.
import json, sys, urllib.request, urllib.parse, subprocess, os, re, time, datetime
KEY = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__))
WM = "https://www.googleapis.com/webmasters/v3"; SC = "https://searchconsole.googleapis.com/v1"
PROP = "sc-domain:hk-growthoperator.de"
tok = subprocess.run(["python3", "-I", os.path.join(HERE, "token.py"), KEY], capture_output=True, text=True, check=True).stdout.strip()
def call(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read(); return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try: return e.code, json.loads(raw)
        except Exception: return e.code, {"raw": raw}
p = urllib.parse.quote(PROP, safe="")
end = datetime.date.today() - datetime.timedelta(days=2); start = end - datetime.timedelta(days=90)
out = {"range": [str(start), str(end)]}
for dims in (["query"], ["page"], ["query", "page"]):
    code, res = call("POST", f"{WM}/sites/{p}/searchAnalytics/query", {"startDate": str(start), "endDate": str(end), "dimensions": dims, "rowLimit": 1000})
    out["+".join(dims)] = res.get("rows", []); print("analytics", dims, code, len(res.get("rows", [])))
urls = []
for sm in ["https://hk-growthoperator.de/sitemap.xml", "https://dealuno.hk-growthoperator.de/sitemap.xml", "https://dealoperator.hk-growthoperator.de/sitemap.xml", "https://website.hk-growthoperator.de/sitemap.xml"]:
    with urllib.request.urlopen(sm, timeout=30) as r: urls += re.findall(r"<loc>([^<]+)</loc>", r.read().decode())
print("urls", len(urls))
insp = {}
for u in urls:
    code, res = call("POST", f"{SC}/urlInspection/index:inspect", {"inspectionUrl": u, "siteUrl": PROP, "languageCode": "de"})
    st = res.get("inspectionResult", {}).get("indexStatusResult", {})
    insp[u] = {"verdict": st.get("verdict"), "coverage": st.get("coverageState"), "lastCrawl": st.get("lastCrawlTime"), "canonical": st.get("googleCanonical"), "robots": st.get("robotsTxtState"), "indexing": st.get("indexingState"), "code": code}
    print("inspect", code, st.get("coverageState"), u)
    time.sleep(0.3)
out["inspection"] = insp
json.dump(out, open(os.path.join(HERE, "..", "gsc-data.json"), "w"), ensure_ascii=False, indent=1)
print("fertig")
