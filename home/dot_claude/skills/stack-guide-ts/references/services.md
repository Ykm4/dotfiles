# 外部サービス選定

## 決済: Stripe

事実上の標準。他の選択肢を検討する必要はほぼない。

### 主要機能

| 機能 | 用途 |
|------|------|
| Stripe Checkout | ホスティッド決済ページ。最速導入 |
| Stripe Billing | サブスクリプション管理 |
| Stripe Connect | マーケットプレイス・プラットフォーム決済 |
| Stripe Elements | カスタム決済 UI コンポーネント |

### 料金

- 日本: 3.6% /トランザクション
- 月額固定費なし

### Workers 対応

- `stripe` パッケージは Cloudflare Workers で動作
- Webhook 検証も Workers で可能

### 主要パッケージ

```
stripe          # サーバーサイド SDK
@stripe/stripe-js  # クライアントサイド SDK
@stripe/react-stripe-js  # React コンポーネント
```

## メール送信

### Resend（推奨）

- **モダン API**: REST ベース。DX が良い
- **React Email**: React でメールテンプレートを作成
- **無料枠**: 100通/日、3,000通/月
- **料金**: Pro $20/月（50,000通/月）
- **Workers 対応**: REST API なので問題なし

```ts
import { Resend } from 'resend'
const resend = new Resend(c.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'noreply@example.com',
  to: 'user@example.com',
  subject: 'Welcome',
  react: WelcomeEmail({ name: 'User' }), // React コンポーネント
})
```

### SendGrid

- **実績**: 最も利用されているメールサービス
- **無料枠**: 100通/日
- **料金**: Essentials $19.95/月（50,000通/月）
- **機能**: マーケティングメール・テンプレートエンジン

### Cloudflare Email Workers

- メールの**受信**処理用。トランザクションメール送信には不向き
- 受信メールのルーティング・フィルタリングに使用

### 推奨

| 条件 | 推奨 |
|------|------|
| 新規プロジェクト | **Resend**（DX 最良） |
| 大量配信が必要 | **SendGrid**（スケール実績） |
| マーケティングメール | **SendGrid** |

## 監視 / エラー追跡

### Sentry（推奨）

- **エラー追跡**: スタックトレース・コンテキスト自動収集
- **パフォーマンス**: トランザクション追跡・Web Vitals
- **無料枠**: 5,000 イベント/月
- **料金**: Team $26/月（50K イベント）
- **SDK**: `@sentry/remix`, `@sentry/nextjs` 等フレームワーク別

### Cloudflare Analytics

- Cloudflare に組み込み。追加設定不要
- トラフィック・パフォーマンスの基本メトリクス
- エラー追跡機能はない → Sentry と併用

### Logflare

- Cloudflare ネイティブのログ集約サービス
- Workers のログを収集・検索
- 無料枠あり

### 推奨構成

| 用途 | ツール |
|------|--------|
| エラー追跡 | **Sentry** |
| トラフィック分析 | **Cloudflare Analytics**（Cloudflare の場合）/ Vercel Analytics |
| ログ集約 | **Logflare**（Cloudflare）or Sentry のログ機能 |

## ストレージ

### Cloudflare R2（Cloudflare の場合）

- S3 互換 API
- **エグレス完全無料**（最大の特徴）
- 無料枠: 10GB ストレージ、100万 Class A 操作/月
- 有料: $0.015/GB/月
- **採用事例**: Nani翻訳では macOS 用 `.dmg` と更新用 `.zip` の配布ファイル保存に R2 を使用。GitHub Actions から直接アップロード ([参考](https://zenn.dev/catnose99/articles/nani-translate))

### GCS（GCP の場合）

- 標準的なオブジェクトストレージ
- $0.02/GB/月（Standard）
- エグレス: $0.12/GB

### Supabase Storage（Supabase の場合）

- Supabase に統合済み
- RLS でアクセス制御
- 無料枠: 1GB
- 画像変換機能あり

### 推奨

| デプロイ先 | 推奨 |
|-----------|------|
| Cloudflare | **R2**（エグレス無料） |
| Vercel | **R2** or **Supabase Storage** |
| GCP | **GCS** |
