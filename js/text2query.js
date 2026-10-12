// なんとなくの文章 → 意図（カテゴリの重み・条件） → Overpass QL
// TRIDENT（text → Overpass QL → OSM → 地図）のパイプラインを辞書ルールで再現する。

import { LEXICON, NEGATION, STRIP, DEFAULT_MIX } from "./lexicon.js";

export function parseIntent(text) {
  const intent = { weights: {}, flags: {}, hits: [], startHour: 10, usedDefault: false };
  const cleaned = text.replace(STRIP, "");

  const hour = cleaned.match(/(\d{1,2})\s*時(から|に|スタート|出発)/);
  if (hour) intent.startHour = Math.min(Math.max(+hour[1], 6), 20);

  // 句読点や逆接で文節に区切り、文節ごとに否定を判定する
  const clauses = cleaned.split(/[、。,.!！?？\n]|けど|けれど|でも|だが|ただ/).filter(Boolean);
  for (const clause of clauses) {
    let rest = clause;
    const found = [];
    for (const entry of LEXICON) {
      const re = new RegExp(entry.pattern, "g");
      const m = rest.match(re);
      if (!m) continue;
      found.push({ entry, word: m[0] });
      rest = rest.replace(re, "□");
    }
    const negative = NEGATION.test(rest);
    for (const { entry, word } of found) {
      const sign = negative ? -1.5 : 1;
      for (const [cat, w] of Object.entries(entry.cats)) {
        intent.weights[cat] = (intent.weights[cat] || 0) + w * sign;
      }
      if (entry.flags) {
        if (negative && word.match(/人混み|混雑|行列/)) intent.flags.quiet = true;
        else if (!negative) Object.assign(intent.flags, entry.flags);
      }
      intent.hits.push({ word, negative, cats: Object.keys(entry.cats), flags: entry.flags || {} });
    }
  }

  if (!Object.values(intent.weights).some((w) => w > 0)) {
    for (const [cat, w] of Object.entries(DEFAULT_MIX)) {
      intent.weights[cat] = (intent.weights[cat] || 0) + w;
    }
    intent.usedDefault = true;
  }
  return intent;
}

function selector(tag) {
  if (!tag.includes("=")) return `["${tag}"]`;
  const [k, v] = tag.split("=");
  return `["${k}"="${v}"]`;
}

// 好み（重み > 0）のカテゴリだけを対象にした Overpass QL を組み立てる
export function buildOverpassQL(intent, conf) {
  const [s, w, n, e] = conf.bbox;
  const lines = [];
  for (const [key, cat] of Object.entries(conf.categories)) {
    if ((intent.weights[key] || 0) <= 0) continue;
    if (intent.flags.indoor && !cat.indoor && !intent.flags.outdoor) continue;
    lines.push(`  // ${cat.label}`);
    for (const tag of cat.osm) lines.push(`  nwr${selector(tag)}(${s},${w},${n},${e});`);
  }
  return `[out:json][timeout:25];\n(\n${lines.join("\n")}\n);\nout center tags;`;
}
