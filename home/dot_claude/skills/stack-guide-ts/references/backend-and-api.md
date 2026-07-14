# バックエンド & API 選定

## 候補一覧

| フレームワーク | 特徴 | 最適なケース |
|--------------|------|------------|
| Hono | 軽量・エッジネイティブ・型安全 RPC | Cloudflare + Remix |
| tRPC | E2E 型安全 API | Next.js プロジェクト |
| Server Actions | Next.js 組み込み | シンプルなデータ変更 |

## Hono

### 特徴

- **軽量**: バンドルサイズ ~14KB。Workers の制限に余裕
- **エッジネイティブ**: Cloudflare Workers / Deno / Bun / Node.js で動作
- **型安全 RPC**: クライアントとサーバー間で API の型を自動共有
- **ミドルウェア豊富**: CORS, JWT, Bearer, Logger, Zod Validator 等
- **Service Bindings 対応**: Cloudflare Worker 間のサービス間通信を型安全に実現（Worker 単位の責務分離に最適）
- **hcWithType**: 大規模 API で IDE パフォーマンスを劣化させない最適化されたクライアント

### Hono RPC の型共有

```ts
// server.ts
const app = new Hono()
  .get('/api/users', async (c) => {
    const users = await db.select().from(usersTable)
    return c.json(users)
  })
  .post('/api/users', zValidator('json', createUserSchema), async (c) => {
    const data = c.req.valid('json')
    const user = await db.insert(usersTable).values(data).returning()
    return c.json(user)
  })

export type AppType = typeof app

// client.ts
import { hc } from 'hono/client'
import type { AppType } from './server'

const client = hc<AppType>('/') // 型安全な API クライアント
const res = await client.api.users.$get() // 戻り値の型が自動推論
```

### remix-hono 統合

Remix を Hono のミドルウェアとして組み込み、API とフロントエンドを統合:

```ts
import { Hono } from 'hono'
import { remix } from 'remix-hono/handler'

const app = new Hono()

// Hono ミドルウェア（認証・ロギング等）
app.use('*', cors())
app.use('*', logger())

// API ルート
const apiRoutes = app
  .basePath('/api')
  .get('/health', (c) => c.json({ status: 'ok' }))

// Remix にフォールバック
app.use('*', remix({ build, mode: process.env.NODE_ENV }))

export type ApiType = typeof apiRoutes
```

### プロダクション採用事例

- **Nani翻訳**（catnose99）: Next.js の Route Handler 上で Hono を使用し API 開発 ([参考](https://zenn.dev/catnose99/articles/nani-translate))
- Hono は Cloudflare Workers だけでなく、Next.js / Vercel 環境でも API レイヤーとして採用される実績あり

## tRPC

### 特徴

- **E2E 型安全**: サーバー定義からクライアントの型が自動生成
- **React Query 統合**: キャッシュ・楽観的更新・無限スクロール
- **Next.js 最適化**: App Router / Pages Router 両対応
- **バンドルサイズ**: Hono より大きい

### 使い分け

- **Next.js + Vercel** → tRPC が自然な選択
- **Remix + Cloudflare** → Hono RPC の方が軽量で相性が良い
- **複雑な API + React Query** → tRPC が強い

## Server Actions (Next.js)

### 特徴

- Next.js App Router 組み込み。追加パッケージ不要
- `"use server"` ディレクティブでサーバー関数を定義
- フォーム送信・データ変更に最適

### 使い分け

- **シンプルな CRUD・フォーム** → Server Actions で十分
- **複雑な API・型共有** → tRPC や Hono RPC を併用
- **外部からの API アクセス** → Server Actions は使えない（REST/tRPC が必要）

## デプロイ先別推奨

| デプロイ先 | フロントエンド | バックエンド推奨 |
|-----------|-------------|----------------|
| Cloudflare | Remix | **Hono** (remix-hono) |
| Cloudflare | Next.js (VINEXT) | **Hono** (standalone API) |
| Vercel | Next.js | **Server Actions** + tRPC（複雑な場合） |
| GCP | Remix | **Hono** |
| GCP | Next.js | **Server Actions** + API Routes |
