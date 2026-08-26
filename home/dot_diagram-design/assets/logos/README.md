# ロゴ資産

アーキテクチャ図（diagram-design の `logo-card-grid` プロファイル）で使う公式ロゴ。

## 出典

- `*.svg` — svgl.app 経由で取得した各社公式ロゴ（2026-08-25 取得）。`_light` / `_dark` は表示テーマ別の変種
- `go.svg` — https://go.dev/images/go-logo-blue.svg （公式ブランドカラーの青。svgl は黒変種のみだったため公式サイトから取得）
- `moneyforward-cloud.png` — https://moneyforward.com/img/mfc_logo.png （公式サイト掲載画像。SVG は非配布のため PNG）
- `aws/*.svg` — AWS 公式 Architecture Icons パッケージ（リリース 07312026、2026-08-25 取得）の 48px サービスアイコン。harmo の backend-fs・backend-stack・medication-notebook・harmo-telemetry で利用中のサービスを収録

## 利用上の注意

- 各ロゴは各社の商標である。社内ドキュメント・構成図での識別目的に限って使う。
- 図へは data URI として埋め込む（アーティファクトの CSP は外部画像を読めない）。
