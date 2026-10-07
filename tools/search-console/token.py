# Access token for the service account via the JWT bearer flow (gcloud cannot issue custom scopes).
import json, sys, time, base64, subprocess, urllib.request, urllib.parse, os
key_path = sys.argv[1]
scopes = "https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/siteverification"
with open(key_path) as f: key = json.load(f)
pem = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sa.pem")
with open(pem, "w") as f: f.write(key["private_key"])
os.chmod(pem, 0o600)
b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=")
now = int(time.time())
header = b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
claim = b64(json.dumps({"iss": key["client_email"], "scope": scopes, "aud": key["token_uri"], "iat": now, "exp": now + 3600}).encode())
signing_input = header + b"." + claim
sig = subprocess.run(["openssl", "dgst", "-sha256", "-sign", pem], input=signing_input, capture_output=True, check=True).stdout
jwt = signing_input + b"." + b64(sig)
data = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": jwt.decode()}).encode()
req = urllib.request.Request(key["token_uri"], data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
with urllib.request.urlopen(req, timeout=30) as r:
    tok = json.load(r)
print(tok["access_token"])
