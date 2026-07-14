# スタックプリセット

## Preset 1: Cloudflare MVP

最小コスト・最速で動くものを作る構成。個人開発・MVP に最適。

| カテゴリ | 推奨 | 備考 |
|---------|------|------|
| プラットフォーム | Cloudflare Workers | $5/月で十分 |
| フロントエンド | Remix (React Router v7) | Cloudflare ネイティブ対応 |
| バックエンド | Hono (remix-hono) | 型安全 RPC |
| DB | Cloudflare D1 | SQLite。無料枠が広い |
| ORM | Drizzle ORM | D1 ネイティブサポート |
| 認証 | Clerk | セットアップ最速。10K MAU まで無料 |
| テスト | Vitest + Testing Library | 最小構成 |
| CI/CD | GitHub Actions（基本） | lint + type-check + deploy |
| モノレポ | 不要 | 単一プロジェクト |
| パッケージマネージャー | Bun | 高速 |
| ランタイム | Bun（ローカル）+ workerd（本番） | |

### 主要パッケージ

```
# Core
@remix-run/cloudflare @remix-run/react react react-dom
hono remix-hono
drizzle-orm drizzle-kit

# Auth
@clerk/remix

# Testing
vitest @testing-library/react

# Dev
wrangler @cloudflare/workers-types
```

### 月額コスト目安

~$5（Cloudflare Workers Paid）+ Clerk 無料枠

---

## Preset 2: Cloudflare Growth

スケールを見据えた SaaS 構成。チーム開発対応。

| カテゴリ | 推奨 | 備考 |
|---------|------|------|
| プラットフォーム | Cloudflare Workers | |
| フロントエンド | Remix (React Router v7) | |
| バックエンド | Hono (remix-hono) | |
| DB | Neon PostgreSQL | Hyperdrive 経由。フル PostgreSQL |
| ORM | Drizzle ORM | Neon HTTP ドライバー |
| 認証 | Auth.js (v5) | 柔軟性重視。Drizzle adapter |
| テスト | Vitest + Playwright + Testing Library | E2E テスト含む |
| CI/CD | GitHub Actions | lint + test + preview + deploy |
| モノレポ | Turborepo | タスクキャッシュ・並列実行 |
| 決済 | Stripe | Checkout + Billing |
| メール | Resend | React Email でテンプレート |
| 監視 | Sentry + Cloudflare Analytics | エラー追跡 + トラフィック |
| ストレージ | Cloudflare R2 | エグレス無料 |
| パッケージマネージャー | pnpm | チーム開発で安定性重視 |
| ランタイム | Bun（ローカル）+ workerd（本番） | |

### 主要パッケージ

```
# Core
@remix-run/cloudflare @remix-run/react react react-dom
hono remix-hono
drizzle-orm drizzle-kit @neondatabase/serverless

# Auth
@auth/core @auth/drizzle-adapter

# Payment
stripe @stripe/stripe-js

# Email
resend @react-email/components

# Monitoring
@sentry/remix

# Testing
vitest @playwright/test @testing-library/react

# Dev
wrangler @cloudflare/workers-types turbo
```

### 月額コスト目安

~$20-40（Cloudflare $5 + Neon ~$15 + Sentry Free + Resend Free）

---

## Preset 3: Vercel Standard

Next.js を最大限活かす Vercel ネイティブ構成。

| カテゴリ | 推奨 | 備考 |
|---------|------|------|
| プラットフォーム | Vercel | Pro $20/ユーザー/月 |
| フロントエンド | Next.js (App Router) | Server Components + Server Actions |
| バックエンド | Server Actions + tRPC（任意） | API Route も利用可 |
| DB | Neon PostgreSQL | Vercel Postgres（内部は Neon） |
| ORM | Drizzle ORM（推奨）or Prisma | |
| 認証 | Auth.js (v5) | NextAuth として最適化 |
| テスト | Vitest + Playwright + Testing Library | |
| CI/CD | Vercel（自動）+ GitHub Actions | Preview Deploy 自動 |
| モノレポ | Turborepo | Vercel が開発元 |
| パッケージマネージャー | pnpm | |
| ランタイム | Node.js | |

### 主要パッケージ

```
# Core
next react react-dom
drizzle-orm drizzle-kit @neondatabase/serverless
# or: prisma @prisma/client

# Auth
next-auth @auth/drizzle-adapter

# API (optional)
@trpc/server @trpc/client @trpc/react-query

# Testing
vitest @playwright/test @testing-library/react

# Dev
turbo
```

### 月額コスト目安

~$20+/ユーザー（Vercel Pro）+ Neon ~$15。チーム拡大でコスト増に注意。

---

## Preset 4: Supabase Fullstack

BaaS で高速プロトタイピング。DB・認証・ストレージ・リアルタイムが統合済み。

| カテゴリ | 推奨 | 備考 |
|---------|------|------|
| プラットフォーム | Cloudflare or Vercel | フロントエンドのデプロイ先 |
| フロントエンド | Remix or Next.js | プラットフォームに応じて選択 |
| バックエンド | Hono or Server Actions（最小限） | Supabase が多くを担う |
| DB | Supabase (PostgreSQL) | Row Level Security 対応 |
| ORM | Drizzle ORM + Supabase Client | RLS は Supabase Client で |
| 認証 | Supabase Auth | ソーシャル・メール対応 |
| リアルタイム | Supabase Realtime | WebSocket・プレゼンス |
| ストレージ | Supabase Storage | 画像・ファイル管理 |
| テスト | Vitest + Playwright | |
| CI/CD | GitHub Actions | |
| パッケージマネージャー | Bun or pnpm | |

### 主要パッケージ

```
# Core (Remix on Cloudflare の場合)
@remix-run/cloudflare @remix-run/react react react-dom
hono remix-hono
@supabase/supabase-js
drizzle-orm drizzle-kit

# Testing
vitest @playwright/test

# Dev
wrangler
```

### 月額コスト目安

無料枠が広い。Pro $25/月で十分なキャパシティ。

---

## プリセット選択ガイド

| 条件 | 推奨プリセット |
|------|--------------|
| コスト最小・個人開発 | Cloudflare MVP |
| SaaS・チーム開発 | Cloudflare Growth |
| Next.js を使いたい | Vercel Standard |
| リアルタイム機能が必要 | Supabase Fullstack |
| 高速プロトタイピング | Supabase Fullstack |
| エンタープライズ SSO | Cloudflare Growth (Clerk) |
