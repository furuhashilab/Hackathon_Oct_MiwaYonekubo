# 舞浜の観光客向け創作マップをつくりました（FOSS4G Hiroshima 振り返りハッカソン）

<!-- グラレコ画像をここに：images/graphic_recording.jpg -->
![グラレコ](images/graphic_recording.jpg)

## 1分でいうと

- 「なんとなくの気分」を書くと、**舞浜駅スタートでディズニー以外**を回るツアーマップができます
- FOSS4G Hiroshima の **TRIDENT**（文章 → Overpass QL → OpenStreetMap → 地図）のしくみを初めて試しました
- AI は Claude Code だけというルールなので、LLM の代わりに**辞書ルール**で「文章 → クエリ」を再現しました

▶ デモ：https://furuhashilab.github.io/Hackathon_Oct_Miwa/
▶ リポジトリ：https://github.com/furuhashilab/Hackathon_Oct_Miwa

## なぜ作ったか

舞浜は私の地元です。観光客の多くはディズニーに来ますが、浦安には漁師町の歴史が残る旧宇田川家住宅や郷土博物館、海辺の公園、銭湯、海鮮のお店など、ほかにも楽しめる場所がたくさんあります。でも「どこに行きたいか」をはっきり言える人は少ないので、**なんとなくの気分**から行き先を見つけられるようにしたいと思いました。

## 参考にした発表

FOSS4G Hiroshima 2026（9/2）
**Building an AI Map Agent with Self-Hosted Planet-Scale OSM and Tiny LLMs**（Yui Matsumura）
https://talks.osgeo.org/foss4g-2026/talk/78TXXS/

「広島市のカフェを見せて」のような文章を LLM で Overpass QL に変換し、OpenStreetMap から実データを取り出して地図にする AI 地図エージェント **TRIDENT** の発表でした。

## しくみ

```
なんとなくの文章 → ことばの解釈（辞書ルール） → Overpass QL → OpenStreetMap → スコアリング → ツアーマップ
```

1. **ことばの解釈**：「のんびり」→ 公園・カフェ・温浴、「海」→ 水辺・展望、「雨」→ 屋内優先 のように変換します。「人混みは苦手」のような否定は「避けたい」として扱います
2. **Overpass QL の自動生成**：好みのカテゴリの OSM タグからクエリを組み立てて画面に表示します（ライブ検索も可能）
3. **ディズニーの除外**：OSM のテーマパーク・ホテルのポリゴン内にある点はすべて除外します
4. **ツアーづくり**：好み × 知られている度（wikidata などのタグ）× 舞浜駅からの距離でスコアを付け、カテゴリが偏らないように選び、近い順に回ります

<!-- スクリーンショット：images/screenshot.png -->

## 試してみた例

| 入力 | できたツアー（抜粋） |
|---|---|
| 海を見ながらのんびり散歩して、おいしい海鮮が食べたい | 浦安マリーナ → 葛西臨海公園 → 海鮮のお店 … |
| 人混みは苦手。昔の浦安の歴史を感じたい | 浦安市郷土博物館 → お寺 … |
| 雨の日に子どもと室内で遊びたい | 葛西臨海水族園 → 角野栄子児童文学館 … |

## わかったこと・むずかしかったこと

- TRIDENT の「文章をそのまま Overpass QL にする」発想は、辞書ルールでもかなり再現できた。クエリが画面に見えるので、なぜその場所が選ばれたか説明しやすい
- 公開 Overpass API はよく混雑してタイムアウトする。発表者が自宅でプラネット規模の OSM を動かしていた理由を実感した → 小さいクエリに分割 ＋ スナップショット同梱で対応
- ディズニー園内の施設も OSM に細かく入っているので、名前だけでなく**区域ポリゴン**で除外する必要があった
- 辞書にない言葉には弱い。次は TRIDENT のように小さなローカル LLM で解釈部分を置き換えてみたい

## クレジット

- 参考発表：Yui Matsumura「Building an AI Map Agent with Self-Hosted Planet-Scale OSM and Tiny LLMs」（FOSS4G Hiroshima 2026）
- データ：© OpenStreetMap contributors（ODbL）／ 背景地図：地理院タイル ／ 地図ライブラリ：MapLibre GL JS
- 開発：Claude Code を使用
- ライセンス：CC BY 4.0
