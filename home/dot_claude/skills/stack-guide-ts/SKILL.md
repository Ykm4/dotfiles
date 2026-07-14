---
name: stack-guide-ts
description: "TypeScript フルスタック技術スタック選定ガイド。新規プロジェクトの技術スタックを対話形式で選定する。Cloudflare/Vercel/GCP 向け React + TypeScript 構成（フロント・バックエンド・DB・認証・テスト・CI/CD・決済・メール・監視等）を推奨。「技術スタック」「tech stack」「スタック選定」「新規プロジェクト」「フルスタック」で使用。"
allowed-tools: Read, AskUserQuestion
---

# TypeScript フルスタック技術スタック選定

対話形式でプロジェクト要件をヒアリングし、TypeScript フルスタック構成を推奨する。

## スコープ

- プラットフォーム: Cloudflare（推奨）、Vercel、GCP
- フレームワーク: React エコシステムのみ（React / Remix / Next.js）
- 言語: TypeScript 一択
- カバー範囲: フロントエンド / バックエンド / DB・ORM / 認証 / テスト / CI/CD / モノレポ / 決済 / メール / 監視 / ストレージ / ランタイム

## 選定の基本原則

本ガイドは「Cloudflare-first」の思想に基づく。

1. **まず「Cloudflareで要件を満たせるか？」を問う** — Yes なら Cloudflare 全力。No なら他を検討
2. **制約で意思決定を減らす** — Cloudflare を選べば DB=D1, Storage=R2, KV=KV と自動で決まる。選定会議が消える
3. **AI 時代との相性** — スタックの制約 = AI へのプロンプト圧縮。自由度の高いスタックは毎回大量のコンテキスト説明が必要になる
4. **Docker からの解放** — コンテナ設計も Dockerfile も不要。`wrangler deploy` でデプロイが完了する

## ワークフロー

3 ラウンドの AskUserQuestion でヒアリングし、最終推奨を出力する。

1. **Round 1: プロジェクト概要** - 種類・規模・デプロイ先
2. **Round 2: アーキテクチャ** - フレームワーク・DB 要件・認証
3. **Round 3: 追加サービス** - 決済・メール・モニタリング等
4. **推奨出力** - 全カテゴリの推奨スタックをまとめて出力

ラウンドごとに回答を分析し、必要に応じてリファレンスを読み込んで判断する。
ユーザーが「おまかせ」「デフォルトで」と言った場合は stack-presets.md の「Cloudflare MVP」を提案する。

---

## Round 1: プロジェクト概要

AskUserQuestion で以下を同時にヒアリングする（3問）。

### Q1: プロジェクトの種類

- **SaaS / Web アプリ** - ユーザー管理・認証・課金がある本格的なサービス
- **個人プロジェクト / ツール** - 自分用または小規模なツール・ダッシュボード
- **E コマース** - 商品販売・決済がメインのサイト
- **コンテンツサイト / ブログ** - 情報発信がメイン、動的機能は少ない

### Q2: 想定規模

- **MVP・個人開発** - まず動くものを最速で作りたい。コスト最小
- **小規模チーム（2-5人）** - チーム開発の基盤が必要。CI/CD・モノレポを考慮
- **成長フェーズ** - スケーラビリティ・監視・構造化が必要

### Q3: デプロイ先

- **Cloudflare（推奨）** - エグレス無料・コスパ最強。Workers（Static Assets）/D1/R2
- **Vercel** - Next.js との親和性最高。チーム課金に注意
- **GCP（Cloud Run）** - コンテナベース。既存 GCP 資産がある場合
- **未定・相談したい** - リファレンスを読み込んで詳細比較を説明

Q3 で「未定」の場合 → `references/platform-comparison.md` を Read で読み込み、料金・機能比較を説明してからデプロイ先を確定する。

---

## Round 2: アーキテクチャ

Round 1 の回答に基づき、AskUserQuestion でヒアリングする（3問）。

### Q4: フロントエンドフレームワーク

Round 1 のデプロイ先に応じて選択肢を調整する:

**Cloudflare の場合:**
- **Remix / React Router v7（推奨）** - Cloudflare ネイティブ対応。Hono 統合で型安全な API
- **Next.js（VINEXT）** - Cloudflare 公式の Vite ベース実装。新しいが高速
- **相談したい** - 詳細比較を説明

**Vercel の場合:**
- **Next.js（推奨）** - Vercel の最適化が活きる
- **Remix** - Vercel でも動作する

**GCP の場合:**
- **Next.js** or **Remix** - 好みで選択

「相談したい」の場合 → `references/frontend-frameworks.md` を Read で読み込んで説明。

### Q5: データベース要件

- **シンプルな CRUD で十分** - D1（Cloudflare）または最安 DB
- **PostgreSQL の機能が必要**（トランザクション・複雑なクエリ・厳密な型）- Neon
- **リアルタイム機能が必要**（WebSocket・プレゼンス）- Supabase
- **まだ分からない** - 説明を聞きたい

「まだ分からない」の場合 → `references/database-and-orm.md` を Read で読み込んで説明。

### Q6: 認証要件

- **ソーシャルログインのみ**（Google / GitHub 等）
- **メール + パスワード認証**
- **エンタープライズ SSO**（SAML / OIDC）
- **不要 / 後で決める**

---

## Round 3: 追加サービス

AskUserQuestion でヒアリングする（2問）。

### Q7: 必要な追加サービス（multiSelect: true）

- **決済（Stripe）** - サブスクリプション・一括課金
- **メール送信（Resend）** - トランザクションメール・通知
- **ファイルアップロード / ストレージ** - 画像・ドキュメント管理
- **モニタリング / エラー追跡（Sentry）** - 本番環境の監視

### Q8: その他の要件や制約

- **特になし → 推奨を提案**
- **自由入力で追記** - 例: 「多言語対応が必要」「既存の Supabase プロジェクトがある」

---

## 決定ロジック

ヒアリング結果から以下のルールで推奨スタックを決定する。

### プラットフォーム → フレームワーク

| デプロイ先 | 第一推奨 | 第二候補 |
|-----------|---------|---------|
| Cloudflare | Remix (React Router v7) | Next.js (VINEXT) |
| Vercel | Next.js (App Router) | Remix |
| GCP | Next.js or Remix | - |

### プラットフォーム × DB 要件 → データベース

| デプロイ先 | シンプル CRUD | PostgreSQL 必要 | リアルタイム |
|-----------|-------------|----------------|------------|
| Cloudflare | **D1** | **Neon** (Hyperdrive) | **Supabase** (Hyperdrive) |
| Vercel | **Neon** | **Neon** | **Supabase** |
| GCP | **Neon** or Cloud SQL | **Neon** or Cloud SQL | **Supabase** |

### ORM

| 条件 | 推奨 |
|------|------|
| Cloudflare + D1 | **Drizzle**（一択） |
| Cloudflare + Neon | **Drizzle** |
| Vercel / GCP | **Drizzle**（推奨）or Prisma |

### バックエンド

| デプロイ先 × フレームワーク | 推奨 |
|--------------------------|------|
| Cloudflare + Remix | **Hono** (remix-hono) |
| Cloudflare + Next.js | **Hono** (standalone API) |
| Vercel + Next.js | **Server Actions** + tRPC（複雑な場合） |
| GCP + Remix | **Hono** |
| GCP + Next.js | **Server Actions** + API Routes |

### 認証

| 要件 | 推奨 | 理由 |
|------|------|------|
| ソーシャルのみ | **Clerk** | セットアップ最速 |
| メール + パスワード | **Auth.js** | 柔軟性が高い |
| エンタープライズ SSO | **Clerk** | SAML/OIDC 内蔵 |
| Supabase 採用済み | **Supabase Auth** | 統合済み |
| 最大限の制御 | **Lucia** | 自前 DB に認証データ |

### 規模 → インフラ

| 規模 | モノレポ | CI/CD | 監視 | パッケージマネージャー |
|------|---------|-------|------|---------------------|
| MVP | 不要 | GitHub Actions（基本） | なし or Sentry Free | Bun |
| 小規模チーム | Turborepo | GitHub Actions | Sentry | Bun or pnpm |
| 成長フェーズ | Turborepo | GitHub Actions + Preview | Sentry + Logflare | pnpm |

### 追加サービス

| カテゴリ | 推奨 | 備考 |
|---------|------|------|
| 決済 | **Stripe** | 事実上の標準 |
| メール | **Resend** | DX 最良。React Email 対応 |
| ストレージ | **R2** (CF) / **GCS** (GCP) | R2 はエグレス無料 |
| 監視 | **Sentry** | + Cloudflare Analytics 併用 |
| ランタイム | **Bun**（ローカル）+ **workerd**（本番） | Cloudflare 前提 |
| テスト | **Vitest** + **Playwright** + **Testing Library** | TS ファースト |

---

## 推奨出力フォーマット

最終推奨は以下のフォーマットで出力する:

```
## 推奨技術スタック: [プロジェクト種類]

### スタック概要

| カテゴリ | 推奨 | 備考 |
|---------|------|------|
| プラットフォーム | ... | ... |
| フロントエンド | ... | ... |
| バックエンド | ... | ... |
| DB | ... | ... |
| ORM | ... | ... |
| 認証 | ... | ... |
| テスト | ... | ... |
| CI/CD | ... | ... |
| モノレポ | ... | ... |
| 決済 | ... | ... |
| メール | ... | ... |
| 監視 | ... | ... |
| ストレージ | ... | ... |
| パッケージマネージャー | ... | ... |
| ランタイム | ... | ... |
| Claude Code スキル | wrangler, durable-objects, agents-sdk | Cloudflare 公式 |

### 主要パッケージ

(カテゴリ別にパッケージ名を列挙)

### アーキテクチャメモ

- [フレームワーク選定理由]
- [DB 選定理由と将来の移行パス]
- [注意点・トレードオフ]
```

推奨を出力したら AskUserQuestion で確認する:
- 「この構成でよいですか？変更したいカテゴリがあれば指定してください」
- カテゴリ単位での差し替えに対応する

---

## リファレンスファイル

必要に応じて以下を Read で読み込む。ユーザーが「相談したい」「詳しく」と言った場合、または決定に迷う場合に参照する。

| ファイル | 読み込むタイミング |
|---------|------------------|
| references/platform-comparison.md | デプロイ先が未定の場合 |
| references/frontend-frameworks.md | フレームワーク選定で迷う場合 |
| references/backend-and-api.md | バックエンド構成の詳細が必要な場合 |
| references/database-and-orm.md | DB/ORM 選定で迷う場合 |
| references/auth-solutions.md | 認証ソリューションの詳細比較が必要な場合 |
| references/devtools-and-infra.md | テスト・CI/CD・モノレポの詳細が必要な場合 |
| references/services.md | 決済・メール・監視の詳細が必要な場合 |
| references/stack-presets.md | プリセット構成の詳細が必要な場合 |
