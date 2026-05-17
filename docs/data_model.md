# データモデル

## 方針

MVP では、表示用の簡易 SVG 座標を使いながら、将来の MapLibre GL JS / GeoJSON / TypeScript 化に移しやすい形でデータを持つ。

現時点では `data/*.json` を静的に読み込む。Next.js 化後は `public/data` 配下へ移す想定。

## railway_segments.json

路線の区間単位データ。山手線は歴史的に段階的に形成されるため、路線全体ではなく区間単位で状態を判定する。

主な項目:

- `id`: 区間 ID
- `lineId`: 所属する路線・テーマ ID
- `lineName`: 表示用の路線名
- `historicalName`: 当時の名称
- `name`: 区間名
- `description`: 説明文
- `category`: 種別
- `plannedYear`: 計画扱いにする年
- `constructionStartYear`: 建設中扱いにする年
- `openedYear`: 開業済み扱いにする年
- `closedYear`: 廃止年。なければ `null`
- `svgPath`: 現サンプル用の SVG パス
- `geoLine`: Leaflet / MapLibre 表示用の概略緯度経度ライン
- `geojsonFile`: 将来の GeoJSON ファイルパス。未整備なら `null`
- `sourceRefs`: 参照元 ID

## stations.json

駅単位データ。現時点では表示位置を `position` に持ち、将来の地図実装用に `geo` を予約する。

主な項目:

- `id`: 駅 ID
- `name`: 駅名
- `openedYear`: 表示開始年
- `closedYear`: 廃止年。なければ `null`
- `lines`: 関連路線・テーマ ID
- `position`: 現サンプル用の SVG 座標
- `geo`: Leaflet / MapLibre 表示用の緯度経度
- `sourceRefs`: 参照元 ID

## events.json

年表・地図イベント用データ。路線や駅と関連付けられるようにする。

主な項目:

- `id`: イベント ID
- `year`: 発生年
- `title`: 表示タイトル
- `body`: 説明文
- `category`: イベント種別
- `relatedSegmentIds`: 関連区間 ID
- `relatedStationIds`: 関連駅 ID
- `sourceRefs`: 参照元 ID

## year_summaries.json

選択年に応じたサイドパネル説明。5年刻みスライダーでも、説明は意味のある節目だけに置く。

主な項目:

- `id`: 要約 ID
- `year`: この年以降に使う説明の開始年
- `phase`: 表示フェーズ名
- `body`: 説明文

## sourceRefs

現時点で使う参照元 ID:

- `jreast-2025`: JR 東日本「山手線が環状線になるまで」
- `kotobank-yamanote`: コトバンク「山手線」
- `japanknowledge-yamanote`: 日本大百科全書「山手線」
