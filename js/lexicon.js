// なんとなくの言葉 → カテゴリの重み・条件 の辞書
// TRIDENT では LLM が文章を Overpass QL に変換するが、ここでは辞書ルールでその役割を担う。
// pattern は正規表現。上から順に評価し、マッチした部分は以降の評価から外す（長い表現を先に書く）。

export const LEXICON = [
  // --- 否定を含む表現（否定判定より先に拾う） ---
  { pattern: "人が少な|空いて|混んでな|穴場|静かな|落ち着", cats: { history: 1, library: 1, park: 1 }, flags: { quiet: true } },
  { pattern: "お金をかけず|お金かけず|お金がかからな", cats: { park: 2, history: 1, library: 1 }, flags: { budget: true } },
  { pattern: "疲れな|歩きすぎな", cats: { cafe: 1, bath: 1 }, flags: { mode: "short" } },

  // --- 雰囲気・気分 ---
  { pattern: "のんびり|ゆっくり|まったり|ぼーっと|ぼんやり|癒|リラックス|ほっと|疲れ|休み", cats: { park: 2, cafe: 2, bath: 2, view: 1 } },
  { pattern: "散歩|散策|ぶらぶら|ぶらり|歩きたい|歩いて", cats: { park: 2, history: 1, beach: 1 } },
  { pattern: "わくわく|ワクワク|楽しい|はしゃ|刺激|遊び", cats: { sports: 2, cinema: 1, view: 1, play: 1 } },
  { pattern: "デート|恋人|カップル|彼女|彼氏|ふたりで|二人で", cats: { view: 2, cafe: 2, aquarium: 2, sweets: 1, beach: 1 } },
  { pattern: "一人|ひとり|ソロ|おひとりさま", cats: { cafe: 1, library: 1, museum: 1, bath: 1 }, flags: { quiet: true } },
  { pattern: "子ども|子供|こども|キッズ|家族|ファミリー|息子|娘", cats: { play: 3, park: 2, aquarium: 2 }, flags: { kids: true } },
  { pattern: "写真|映え|インスタ|カメラ|撮り", cats: { view: 2, park: 1, sweets: 1, history: 1, beach: 1 } },
  { pattern: "安く|無料|節約|タダ|お金がない", cats: { park: 2, history: 1, library: 1 }, flags: { budget: true } },

  // --- 場所・景色（「海鮮」を「海」より先に拾う） ---
  { pattern: "海鮮|寿司|すし|鮨|貝|あさり|海苔|刺身", cats: { seafood: 3, food: 1 } },
  { pattern: "夕日|夕焼け|サンセット|黄昏", cats: { beach: 2, view: 3 } },
  { pattern: "景色|眺め|絶景|夜景|展望|高いところ|高い所|観覧車", cats: { view: 3, beach: 1 } },
  { pattern: "海|潮風|水辺|港|波|ベイ|川|マリーナ|ボート|釣り", cats: { beach: 3, park: 1, view: 1, seafood: 1 } },
  { pattern: "自然|緑|花|植物|木陰|森|芝生|ピクニック", cats: { park: 3, nature: 2 } },
  { pattern: "鳥|野鳥|生き物|動物|虫|干潟", cats: { nature: 3, aquarium: 2 } },
  { pattern: "魚|水族館|ペンギン|マグロ", cats: { aquarium: 3, seafood: 1 } },

  // --- 歴史・文化 ---
  { pattern: "歴史|昔|レトロ|古い|下町|昭和|漁師町|ノスタルジ|郷土|文化|伝統", cats: { history: 2, museum: 3 } },
  { pattern: "神社|お寺|寺|参拝|御朱印|パワースポット|お参り", cats: { history: 3 } },
  { pattern: "博物館|美術館|アート|展示|学び|勉強|知りたい", cats: { museum: 3, library: 1 } },
  { pattern: "本|読書|図書館", cats: { library: 3, cafe: 1 }, flags: { quiet: true } },

  // --- 食 ---
  { pattern: "カフェ|コーヒー|珈琲|紅茶|お茶", cats: { cafe: 3 } },
  { pattern: "甘い|スイーツ|ケーキ|パン|アイス|おやつ|和菓子", cats: { sweets: 3, cafe: 1 } },
  { pattern: "お腹|食べ|ランチ|ご飯|ごはん|グルメ|ディナー|腹ぺこ|美味し|おいし|ラーメン|カレー|焼肉", cats: { food: 3, seafood: 1 } },

  // --- アクティビティ ---
  { pattern: "温泉|銭湯|お風呂|風呂|サウナ|湯", cats: { bath: 3 } },
  { pattern: "買い物|ショッピング|お土産|おみやげ|服|雑貨", cats: { shopping: 3 } },
  { pattern: "体を動か|運動|スポーツ|アクティブ|汗|ボウリング|ゲーム", cats: { sports: 3, play: 1, park: 1 } },
  { pattern: "映画|カラオケ|ライブ|演劇|劇場|歌|コンサート", cats: { cinema: 3 } },
  { pattern: "人混み|混雑|行列", cats: { shopping: 1 } },

  // --- 天気・条件 ---
  { pattern: "雨|室内|屋内|濡れ|暑い|寒い", cats: { museum: 1, aquarium: 1, cafe: 1, bath: 1, library: 1 }, flags: { indoor: true } },
  { pattern: "晴れ|外で|アウトドア|日向ぼっこ|太陽", cats: { park: 1 }, flags: { outdoor: true } },

  // --- 時間・移動手段 ---
  { pattern: "サクッと|ちょっと|少しだけ|1時間|2時間|一時間|二時間", cats: {}, flags: { stops: 3 } },
  { pattern: "半日|午前|午後|3時間|4時間", cats: {}, flags: { stops: 4 } },
  { pattern: "一日|1日|丸一日|まるっと|たっぷり|朝から晩", cats: {}, flags: { stops: 6 } },
  { pattern: "自転車|チャリ|サイクリング|レンタサイクル", cats: {}, flags: { mode: "bike" } },
  { pattern: "車|ドライブ", cats: {}, flags: { mode: "car" } },
  { pattern: "徒歩|歩き", cats: {}, flags: { mode: "walk" } },
];

// この表現が同じ文節にあれば、その文節で拾った好みを「避けたい」に反転する
// 「ディズニー以外で」などは前提条件なので、解析前に取り除く
export const STRIP = /(東京)?(ディズニー|Disney|TDL|TDS)(ランド|シー|リゾート)?(以外|じゃなく|じゃない|ではなく|ではない|を?除いて|は?抜きで?|はもういい|は飽きた)(で|の|に|も)?/gi;

export const NEGATION = /苦手|嫌い|嫌|いや|イヤ|避け|以外|たくない|いらない|なし|NG|パス|やめ|興味ない|好きじゃない/;

// 言葉が見つからなかったときの「舞浜おまかせミックス」
export const DEFAULT_MIX = { park: 1, beach: 1.5, view: 1, history: 1, cafe: 1, seafood: 1, aquarium: 1 };
