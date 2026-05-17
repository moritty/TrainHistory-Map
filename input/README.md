# tokyo_private_railway_codex

東京都内の私鉄開業史を、時系列地図アプリとして実装するためのCodex向け素材一式です。

## ファイル

- `tokyo_private_railway_openings.md`
  - 企画・対象範囲・開業順20件・実装補足
- `railway_openings.json`
  - アプリに読み込ませる初期データ
- `codex_prompt.md`
  - Codexへそのまま貼れる実装依頼プロンプト

## 想定アプリ

- Next.js
- TypeScript
- Tailwind CSS
- MapLibre GL JS
- 静的JSON読み込み
- 年代スライダーで路線表示を切り替える

## 注意

このデータはMVP用の初期案です。
厳密な史実データとして扱う場合は、各鉄道会社の公式沿革、国土交通省資料、自治体資料などで追加検証してください。
