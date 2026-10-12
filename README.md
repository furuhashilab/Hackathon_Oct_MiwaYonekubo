# 舞浜の観光客向け創作マップ🗺️

**▶ デモ: https://furuhashilab.github.io/Hackathon_Oct_Miwa/**

「人混みは苦手。海を見ながらのんびりしたい」のように**なんとなくの気分**を書くと、舞浜駅を出発して**ディズニー以外**で楽しめる場所をめぐる観光ツアーマップを作ります。

FOSS4G Hiroshima / SotM Asia OSAKA 振り返りハッカソン（2026年10月・古橋研究室）の成果物です。

## 参考にした発表

- **Building an AI Map Agent with Self-Hosted Planet-Scale OSM and Tiny LLMs**（Yui Matsumura、FOSS4G Hiroshima 2026、9/2 Himawari）
  https://talks.osgeo.org/foss4g-2026/talk/78TXXS/

この発表で紹介された **TRIDENT** は、「広島市のカフェを見せて」のような文章を LLM で **Overpass QL** に変換し、OpenStreetMap からデータを取り出して地図にする AI 地図エージェントです。今回はこのしくみを初めて試しました。

## しくみ

```
なんとなくの文章 ──▶ ことばの解釈 ──▶ Overpass QL ──▶ OpenStreetMap ──▶ スコアリング ──▶ ツアーマップ
                     （辞書ルール）    （自動生成）     （Overpass API）   （好み×距離×多様性）  （MapLibre GL JS）
```

1. **ことばの解釈**（[js/lexicon.js](js/lexicon.js), [js/text2query.js](js/text2query.js)）
   ハッカソンのルールで AI は Claude Code 以外使えないため、TRIDENT で LLM が担う「文章 → クエリ」の変換を、Claude Code と一緒に作った**辞書ルール**で置き換えました。
   - 「のんびり」→ 公園・カフェ・温浴、「海」→ 水辺・展望、「雨」→ 屋内を優先、のように言葉をカテゴリの重みに変換します
   - 「人混みは**苦手**」「お店は**いらない**」のような否定は、その文節の好みを「避けたい」に反転します
   - 「自転車」「半日」「11時から」から移動手段・立ち寄り数・出発時刻を読み取ります
2. **Overpass QL の生成**：好みのカテゴリの OSM タグ（`leisure=park`、`tourism=aquarium` など、[data/categories.json](data/categories.json)）から Overpass QL を組み立て、画面に表示します。「Overpass APIでライブ検索」をオンにすると、そのクエリを実際に Overpass API に投げます。
3. **ディズニーの除外**：名前に「ディズニー」を含む施設に加えて、OSM の `tourism=theme_park` ポリゴン（東京ディズニーランド・シー）の中にある点をすべて除外しています。
4. **ツアーづくり**：好みとの一致度＋OSM タグの充実度（wikidata など）－舞浜駅からの距離でスコアを付け、カテゴリが偏らないように選び、舞浜駅から近い順にたどります。

## ローカルで動かす

```bash
python3 -m http.server 8765
```

http://localhost:8765 を開きます。POI のスナップショットを更新するときは次を実行します。

```bash
python3 scripts/fetch_osm.py
```

## データとクレジット

- POI：© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)（ODbL）。`data/pois.geojson` と `data/exclude_areas.geojson` は ODbL のもとで提供されます
- 背景地図：[地理院タイル](https://maps.gsi.go.jp/development/ichiran.html)（淡色地図）
- 地図ライブラリ：[MapLibre GL JS](https://maplibre.org/)（BSD-3-Clause）
- 開発：Claude Code（Anthropic）を使用

## ライセンス

このリポジトリのコードと文章は [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja) です（OSM 由来のデータを除く）。
© 2026 Miwa / FuruhashiLab
