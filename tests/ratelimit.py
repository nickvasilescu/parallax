"""Rate limits cannot be dodged with a forged X-Forwarded-For. Usage: ratelimit.py <base-url>

Run by tests/run.py without PARALLAX_TRUSTED_PROXIES, so the header must be ignored.
"""
import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1].rstrip("/")
results = []


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


def post(path, body, forwarded):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "X-Forwarded-For": forwarded},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status
    except urllib.error.HTTPError as err:
        return err.code


# The login limit is 20 per quarter hour. A different forged address on every try must not reset it.
codes = [post("/api/auth/login", {"email": "nobody@example.com", "password": "wrong password"}, f"203.0.113.{i}") for i in range(1, 31)]
check("bad logins are answered 400 at first", codes[0] == 400, str(codes[0]))
check("a forged X-Forwarded-For does not reset the login limit", 429 in codes, f"first 429 at try {codes.index(429) + 1}" if 429 in codes else "never limited")

# Guest creation is limited to 10 an hour, the same way.
guests = [post("/api/auth/guest", {}, f"198.51.100.{i}") for i in range(1, 21)]
check("a forged X-Forwarded-For does not reset the guest limit", 429 in guests, f"first 429 at try {guests.index(429) + 1}" if 429 in guests else "never limited")

sys.exit(0 if all(results) else 1)
