# Codexへの実装依頼プロンプト

Next.js + TypeScript + Tailwind CSS + MapLibre GL JS で、東京都内の私鉄開業史を時系列地図で表示するMVPを作ってください。

## 目的

東京都内の私鉄が1900年代初頭からどのように放射状に広がっていったかを、地図とタイムラインで可視化したいです。

## 要件

- 地図を表示する
- 年代スライダーを表示する
- スライダーの範囲は1900年〜1930年
- `public/data/railway_openings.json` を読み込む
- `openedYear` が選択年以下の路線だけ表示する
- `closed` ステータスの路線はグレー表示にする
- `opened` ステータスの路線は緑の実線にする
- `not_yet` の路線は非表示にする
- 地図上の路線をクリックするとサイドパネルに詳細を表示する
- サイドパネルには、開業日、開業区間、当時の会社、現在の路線イメージ、表示テーマ、notesを表示する
- 初期表示は東京23区周辺
- GeoJSONファイルはまだ存在しないので、最初は `approxCoordinates` から仮のLineStringを生成して動く状態にする
- あとから `public/data/geojson/*.geojson` に差し替えられる設計にする

## コンポーネント構成案

- `components/MapView.tsx`
- `components/TimelineSlider.tsx`
- `components/SidePanel.tsx`
- `components/LayerControls.tsx`
- `lib/railwayStatus.ts`
- `lib/dataLoader.ts`
- `types/railway.ts`

## まず作るもの

同梱の `railway_openings.json` 20件のデータを読み込み、年を動かすと路線の表示数が増えていくプロトタイプを作ってください。
