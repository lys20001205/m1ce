import json
import time
import urllib.request
from pathlib import Path

TOPIC = "roundhouse-log-f333c88ded8549f084c70bd5cceb0a7f"
URL = f"https://ntfy.sh/{TOPIC}/json?poll=1&since=2h"

with urllib.request.urlopen(URL, timeout=20) as resp:
    raw = resp.read().decode("utf-8", errors="replace")

rows = []
for line in raw.splitlines():
    line = line.strip()
    if not line:
        continue
    try:
        msg = json.loads(line)
    except Exception:
        continue
    if msg.get("event") != "message":
        continue
    body = msg.get("message", "")
    try:
        payload = json.loads(body)
    except Exception:
        payload = {"raw": body}
    rows.append({
        "ntfy_id": msg.get("id"),
        "ntfy_time": msg.get("time"),
        "payload": payload,
    })

# Keep latest first by ntfy time, then retain a compact history.
rows.sort(key=lambda r: r.get("ntfy_time") or 0)
latest = rows[-80:]

summary = {
    "fetched_at": int(time.time()),
    "count": len(latest),
    "sessions": {},
    "messages": latest,
}
for item in latest:
    p = item.get("payload") or {}
    sid = p.get("s") or p.get("session") or "UNKNOWN"
    sess = summary["sessions"].setdefault(sid, {"count": 0, "latest": None, "reasons": []})
    sess["count"] += 1
    sess["latest"] = p.get("state") or p
    reason = p.get("reason")
    if reason:
        sess["reasons"].append(reason)

Path("telemetry_snapshot.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"count": summary["count"], "sessions": summary["sessions"]}, ensure_ascii=False, indent=2))
