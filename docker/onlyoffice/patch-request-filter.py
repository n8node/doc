"""Merge request-filtering-agent into DS local.json (run inside onlyoffice container)."""
from __future__ import annotations

import json
import os

path = "/etc/onlyoffice/documentserver/local.json"

data: dict = {}
if os.path.exists(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

co = data.setdefault("services", {}).setdefault("CoAuthoring", {})
rfa = co.setdefault("request-filtering-agent", {})
rfa["allowPrivateIPAddress"] = True
rfa["allowMetaIPAddress"] = True

with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("OK:", path)
