import { parseIntent, buildOverpassQL } from "./text2query.js";

const OVERPASS = "https://overpass-api.de/api/interpreter";
const SPEED_KMH = { walk: 4, short: 4, bike: 12, car: 20 };
const DIST_PENALTY = { walk: 0.5, short: 0.9, bike: 0.15, car: 0.05 };
const MODE_LABEL = { walk: "徒歩", short: "徒歩（近場）", bike: "自転車", car: "車" };
const STAY_MIN = {
  park: 40, beach: 30, view: 30, nature: 45, aquarium: 90, museum: 60, history: 20, cafe: 45, sweets: 20,
  food: 60, seafood: 60, bath: 90, shopping: 60, sports: 60, play: 40, library: 45, cinema: 120, attraction: 30,
};
const EAT = new Set(["food", "seafood", "cafe", "sweets"]);

const $ = (id) => document.getElementById(id);
let conf, snapshot, excludeRings, map;
let lastPicks = new Set();

init();

async function init() {
  [conf, snapshot, excludeRings] = await Promise.all([
    fetch("data/categories.json").then((r) => r.json()),
    fetch("data/pois.geojson").then((r) => r.json()),
    fetch("data/exclude_areas.geojson").then((r) => r.json()).then((g) => g.features.map((f) => f.geometry.coordinates[0])),
  ]);
  $("snapshot-date").textContent = snapshot.metadata.fetched.slice(0, 10);

  map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources: {
        gsi: {
          type: "raster",
          tiles: ["https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a> | POI: © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
        },
      },
      layers: [{ id: "gsi", type: "raster", source: "gsi" }],
    },
    center: [conf.start.lon, conf.start.lat],
    zoom: 13,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl(), "top-right");
  map.on("load", () => {
    map.addSource("route", { type: "geojson", data: emptyFC() });
    map.addLayer({
      id: "route", type: "line", source: "route",
      paint: { "line-color": "#e8590c", "line-width": 4, "line-dasharray": [1.5, 1.2] },
    });
    const fromHash = decodeURIComponent(location.hash.replace(/^#q=/, ""));
    if (fromHash) $("query").value = fromHash;
    run();
  });

  $("form").addEventListener("submit", (e) => { e.preventDefault(); lastPicks = new Set(); run(); });
  $("reroll").addEventListener("click", () => run(true));
  document.querySelectorAll(".example").forEach((b) =>
    b.addEventListener("click", () => { $("query").value = b.textContent; lastPicks = new Set(); run(); }));
}

const emptyFC = () => ({ type: "FeatureCollection", features: [] });

async function run(reroll = false) {
  const text = $("query").value.trim();
  history.replaceState(null, "", text ? `#q=${encodeURIComponent(text)}` : location.pathname);
  const intent = parseIntent(text);
  const ql = buildOverpassQL(intent, conf);
  renderIntent(intent, ql);

  let pois = snapshot.features;
  $("source").textContent = `スナップショット（${snapshot.metadata.fetched.slice(0, 10)} 取得）`;
  if ($("live").checked) {
    $("source").textContent = "Overpass API に問い合わせ中…";
    try {
      pois = await fetchLive(ql);
      $("source").textContent = `Overpass API ライブ取得（${pois.length}件）`;
    } catch (err) {
      $("source").textContent = `ライブ取得に失敗したのでスナップショットを使用（${err.message}）`;
    }
  }

  const exclude = reroll ? lastPicks : new Set();
  const tour = planTour(pois, intent, exclude);
  if (reroll && tour.stops.length === 0) return run(false);
  tour.stops.forEach((s) => lastPicks.add(s.f.properties.id));
  renderTour(tour, intent);
}

async function fetchLive(ql) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  const res = await fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: ql }), signal: ctrl.signal });
  clearTimeout(timer);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();
  const ex = new RegExp(conf.exclude_name_pattern);
  return raw.elements.flatMap((el) => {
    const tags = el.tags || {};
    const name = tags["name:ja"] || tags.name;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!name || lat == null || ex.test(name) || ex.test(tags.operator || "")) return [];
    if (excludeRings.some((r) => inside(lon, lat, r))) return [];
    return [{
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: { id: `${el.type}/${el.id}`, name, cats: classify(tags), tags },
    }];
  });
}

function classify(tags) {
  return Object.entries(conf.categories)
    .filter(([, c]) => c.osm.some((t) => {
      const [k, v] = t.split("=");
      return v === undefined ? k in tags : tags[k] === v;
    }))
    .map(([key]) => key);
}

function inside(lon, lat, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[j];
    if ((y1 > lat) !== (y2 > lat) && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) hit = !hit;
  }
  return hit;
}

function distKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371, rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function scorePoi(f, intent, mode, start) {
  const { cats, tags } = f.properties;
  const ws = cats.map((c) => intent.weights[c] || 0);
  if (!ws.length) return null;
  const best = Math.max(...ws);
  if (best <= 0) return null;
  let score = best + Math.min(0, ...ws);
  const primary = cats[ws.indexOf(best)];

  // OSM のタグの充実度を「知られている度」の目安にする
  if (tags.wikidata) score += 1;
  if (tags.wikipedia) score += 0.5;
  if (tags.website || tags["contact:website"]) score += 0.2;
  if (tags["name:en"]) score += 0.2;
  if (tags.brand) score -= intent.flags.quiet ? 1.5 : 0.5;
  if (intent.flags.quiet && cats.includes("shopping")) score -= 1;

  const indoor = cats.some((c) => conf.categories[c].indoor);
  if (intent.flags.indoor && !intent.flags.outdoor && !indoor) score *= 0.2;
  if (intent.flags.outdoor && !intent.flags.indoor && indoor && !EAT.has(primary)) score -= 0.5;

  const d = distKm(start, f.geometry.coordinates);
  score -= d * DIST_PENALTY[mode];
  return { f, score, primary, d };
}

function planTour(pois, intent, exclude) {
  const mode = intent.flags.mode || "walk";
  const nStops = intent.flags.stops || 5;
  const start = [conf.start.lon, conf.start.lat];

  const ranked = pois
    .filter((f) => !exclude.has(f.properties.id))
    .map((f) => scorePoi(f, intent, mode, start))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  // 多様性：同じカテゴリは2か所まで、食べる系は合計2か所（1日なら3か所）、近すぎる場所は除く
  const picked = [], perCat = {};
  let eat = 0;
  const eatMax = nStops >= 6 ? 3 : 2;
  for (const r of ranked) {
    if (picked.length >= nStops) break;
    if ((perCat[r.primary] || 0) >= 2) continue;
    if (EAT.has(r.primary) && eat >= eatMax) continue;
    if (picked.some((p) => distKm(p.f.geometry.coordinates, r.f.geometry.coordinates) < 0.2)) continue;
    picked.push(r);
    perCat[r.primary] = (perCat[r.primary] || 0) + 1;
    if (EAT.has(r.primary)) eat++;
  }

  // 舞浜駅から最寄り順にたどる（貪欲法）
  const stops = [];
  let cur = start, t = intent.startHour * 60, total = 0;
  const rest = [...picked];
  while (rest.length) {
    let bi = 0, bd = Infinity;
    rest.forEach((r, i) => {
      const d = distKm(cur, r.f.geometry.coordinates);
      if (d < bd) { bd = d; bi = i; }
    });
    const r = rest.splice(bi, 1)[0];
    const move = Math.round((bd * 1.3 / SPEED_KMH[mode]) * 60); // 直線距離 ×1.3 を道のりの目安にする
    t += move;
    const stay = STAY_MIN[r.primary] || 30;
    stops.push({ ...r, legKm: bd * 1.3, move, arrive: t, stay });
    t += stay;
    total += bd * 1.3;
    cur = r.f.geometry.coordinates;
  }
  return { stops, mode, totalKm: total, end: t };
}

const hhmm = (min) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, "0")}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function renderIntent(intent, ql) {
  const chips = intent.hits.map((h) => {
    const to = [
      ...h.cats.map((c) => conf.categories[c].icon + conf.categories[c].label),
      ...(h.flags.indoor ? ["☔屋内優先"] : []),
      ...(h.flags.quiet ? ["🤫静かめ"] : []),
      ...(h.flags.mode ? [`🚲${MODE_LABEL[h.flags.mode]}`] : []),
      ...(h.flags.stops ? [`⏱${h.flags.stops}か所`] : []),
      ...(h.flags.budget ? ["💰節約"] : []),
    ];
    return `<li class="chip ${h.negative ? "neg" : ""}"><b>「${esc(h.word)}」</b>${h.negative ? " を避ける" : ""} → ${to.join("・") || "—"}</li>`;
  });
  if (intent.usedDefault) chips.push('<li class="chip">ピンとくる言葉がなかったので「舞浜おまかせミックス」にしました</li>');
  $("intent").innerHTML = chips.join("");
  $("ql").textContent = ql;
}

let markers = [];
function renderTour(tour, intent) {
  markers.forEach((m) => m.remove());
  markers = [];
  const startLL = [conf.start.lon, conf.start.lat];
  const el = document.createElement("div");
  el.className = "pin start";
  el.textContent = "駅";
  markers.push(new maplibregl.Marker({ element: el }).setLngLat(startLL)
    .setPopup(new maplibregl.Popup().setText(`スタート：${conf.start.name}`)).addTo(map));

  const hitWords = (cats) => intent.hits.filter((h) => !h.negative && h.cats.some((c) => cats.includes(c))).map((h) => `「${h.word}」`);
  const items = tour.stops.map((s, i) => {
    const p = s.f.properties;
    const cat = conf.categories[s.primary];
    const words = hitWords(p.cats);
    const why = words.length ? `${[...new Set(words)].join("")}から` : "おまかせ";
    const osm = `https://www.openstreetmap.org/${p.id}`;
    const [lon, lat] = s.f.geometry.coordinates;
    const prev = i === 0 ? startLL : tour.stops[i - 1].f.geometry.coordinates;
    const engine = tour.mode === "bike" ? "fossgis_osrm_bike" : tour.mode === "car" ? "fossgis_osrm_car" : "fossgis_osrm_foot";
    const route = `https://www.openstreetmap.org/directions?engine=${engine}&route=${prev[1]},${prev[0]};${lat},${lon}`;
    const web = p.tags.website || p.tags["contact:website"];

    const pin = document.createElement("div");
    pin.className = "pin";
    pin.textContent = i + 1;
    pin.title = p.name;
    markers.push(new maplibregl.Marker({ element: pin }).setLngLat([lon, lat])
      .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(
        `<b>${i + 1}. ${esc(p.name)}</b><br>${cat.icon} ${cat.label}<br><small>${esc(why)}</small><br><a href="${osm}" target="_blank" rel="noopener">OSMで見る</a>`))
      .addTo(map));

    return `<li>
      <div class="leg">${MODE_LABEL[tour.mode]} 約${s.move}分（${s.legKm.toFixed(1)}km） <a href="${route}" target="_blank" rel="noopener">道順</a></div>
      <div class="stop" data-i="${i}">
        <span class="num">${i + 1}</span>
        <div>
          <div class="time">${hhmm(s.arrive)}〜${hhmm(s.arrive + s.stay)}</div>
          <div class="name">${cat.icon} ${esc(p.name)}</div>
          <div class="meta">${cat.label} ・ ${esc(why)}選びました ・ <a href="${osm}" target="_blank" rel="noopener">OSM</a>${web ? ` ・ <a href="${esc(web)}" target="_blank" rel="noopener">Web</a>` : ""}</div>
        </div>
      </div>
    </li>`;
  });

  $("tour").innerHTML = items.length
    ? items.join("")
    : '<li class="empty">条件に合う場所が見つかりませんでした。言葉を変えてみてください。</li>';
  $("summary").textContent = items.length
    ? `${hhmm(intent.startHour * 60)} 舞浜駅スタート → ${hhmm(tour.end)} ごろ終了 ／ ${tour.stops.length}か所 ・ ${MODE_LABEL[tour.mode]} ・ 移動 約${tour.totalKm.toFixed(1)}km`
    : "";
  document.querySelectorAll(".stop").forEach((d) =>
    d.addEventListener("click", () => {
      const s = tour.stops[+d.dataset.i];
      map.flyTo({ center: s.f.geometry.coordinates, zoom: 16 });
      markers[+d.dataset.i + 1].togglePopup();
    }));

  const coords = [startLL, ...tour.stops.map((s) => s.f.geometry.coordinates)];
  map.getSource("route").setData({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} });
  const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
  map.fitBounds(b, { padding: 60, maxZoom: 15 });
}
