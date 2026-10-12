"""舞浜周辺のPOIをOverpass APIから取得し、data/pois.geojson に保存する。

アプリはライブでOverpass APIに問い合わせるが、混雑時のフォールバック用に
このスナップショットを同梱する。

    python3 scripts/fetch_osm.py
"""
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONF = json.loads((ROOT / "data" / "categories.json").read_text(encoding="utf-8"))
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]


def selector(tag):
    if "=" in tag:
        k, v = tag.split("=", 1)
        return f'["{k}"="{v}"]'
    return f'["{tag}"]'


def build_query(cat):
    s, w, n, e = CONF["bbox"]
    lines = [f"  nwr{selector(tag)}({s},{w},{n},{e});" for tag in cat["osm"]]
    return "[out:json][timeout:60];\n(\n" + "\n".join(lines) + "\n);\nout center tags;"


def classify(tags):
    cats = []
    for key, cat in CONF["categories"].items():
        for tag in cat["osm"]:
            if "=" in tag:
                k, v = tag.split("=", 1)
                if tags.get(k) == v:
                    cats.append(key)
                    break
            elif tag in tags:
                cats.append(key)
                break
    return cats


def overpass(query):
    data = urllib.parse.urlencode({"data": query}).encode()
    raw = None
    for endpoint in ENDPOINTS * 3:
        req = urllib.request.Request(endpoint, data=data, headers={"User-Agent": "Hackathon_Oct_Miwa/1.0 (furuhashilab)"})
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                raw = json.load(res)
            break
        except Exception as err:
            print(f"{endpoint}: {err}")
            time.sleep(10)
    if raw is None:
        raise SystemExit("all Overpass endpoints failed")
    return raw


def fetch_exclude_areas():
    """ディズニーリゾートのパークとホテルの区域ポリゴンを取得する。園内施設はこの中にある点として除外する。"""
    s, w, n, e = CONF["bbox"]
    raw = overpass(f'[out:json][timeout:60];way["tourism"~"^(theme_park|hotel)$"]["name"~"{CONF["exclude_name_pattern"]}"]({s},{w},{n},{e});out geom;')
    polygons = []
    for el in raw["elements"]:
        ring = [[round(p["lon"], 6), round(p["lat"], 6)] for p in el["geometry"]]
        polygons.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [ring]},
            "properties": {"name": el["tags"].get("name")},
        })
    out = {"type": "FeatureCollection", "features": polygons}
    (ROOT / "data" / "exclude_areas.geojson").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    return [f["geometry"]["coordinates"][0] for f in polygons]


def inside(lon, lat, ring):
    hit = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def main():
    rings = fetch_exclude_areas()
    # 公開サーバーの負荷を下げるため、カテゴリごとに小さく分けて問い合わせる
    elements = {}
    for key, cat in CONF["categories"].items():
        for el in overpass(build_query(cat))["elements"]:
            elements[(el["type"], el["id"])] = el
        print(f"{key}: {len(elements)} elements so far")

    exclude = re.compile(CONF["exclude_name_pattern"])
    features = []
    for el in elements.values():
        tags = el.get("tags", {})
        name = tags.get("name:ja") or tags.get("name")
        if not name or exclude.search(name) or exclude.search(tags.get("operator", "")):
            continue
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None or any(inside(lon, lat, r) for r in rings):
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {"id": f'{el["type"]}/{el["id"]}', "name": name, "cats": classify(tags), "tags": tags},
        })

    out = {
        "type": "FeatureCollection",
        "metadata": {
            "source": "© OpenStreetMap contributors (ODbL)",
            "fetched": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "features": features,
    }
    (ROOT / "data" / "pois.geojson").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"{len(features)} features saved")


if __name__ == "__main__":
    main()
