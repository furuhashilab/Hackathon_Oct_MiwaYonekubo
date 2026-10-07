# Hackathon_Oct_MiwaYonekubo

# DuckDB × PLATEAU で試す Spatial-Semantic RAG

> FOSS4G Hiroshima 2026 振り返りハッカソン（2026年10月）

## 概要

FOSS4G Hiroshima 2026（2026年9月2日）で発表された
**青木亮佑氏**の発表
[「Portable Spatial-Semantic RAG for 3D City Models Using DuckDB」](https://talks.osgeo.org/foss4g-2026/talk/ER7ZFX/)
を参考に、「抽象的な言葉から行きたい場所を探す」アプリを DuckDB で試作

## 選んだ新技術

**DuckDB vss 拡張**（Vector Similarity Search）

これまで pgvector + PostgreSQL 構成でベクター検索を行っていたが、
`spatial` 拡張と `vss` 拡張を組み合わせることで、
**サーバーレス・1ファイルで空間検索 + セマンティック検索を同時に行える**ことを
この発表で初めて知った。

## ファイル構成

```
/
├── index.html      # GitHub Pages 発表ページ（グラレコ入り）
└── README.md       # このファイル
```

## 参照リンク

- 元発表：<https://talks.osgeo.org/foss4g-2026/talk/ER7ZFX/>
- スライド：<https://speakerdeck.com/ra0kley/portable-spatial-semantic-rag-for-3d-city-models-using-duckdb>
- DuckDB vss：<https://duckdb.org/docs/stable/core_extensions/vss>
- DuckDB spatial：<https://duckdb.org/docs/stable/core_extensions/spatial/overview>
- Project PLATEAU：<https://www.mlit.go.jp/plateau/en/>


本ページは Claude Code のみを用いて作成
