# データベース & ORM 選定

## データベース比較

### 概要

| DB | 種類 | 特徴 | 最適なケース |
|----|------|------|------------|
| Cloudflare D1 | SQLite | Cloudflare ネイティブ。コスト最小 | MVP・シンプルな CRUD |
| Neon | PostgreSQL | サーバーレス PostgreSQL。Hyperdrive 対応 | スケール・複雑なクエリ |
| Supabase | PostgreSQL | BaaS。Auth・Storage・Realtime 統合 | 高速プロトタイピング |
| Turso | LibSQL (SQLite) | エッジレプリカ対応。D1 の代替 | マルチリージョン読み取り |

### Turso の特徴

- LibSQL（SQLite フォーク）ベース。エッジレプリカで低レイテンシ
- 無料枠: 9GB ストレージ、500DB
- Nani翻訳では「エッジからでも接続しやすい」という理由で採用 ([参考](https://zenn.dev/catnose99/articles/nani-translate))
- Cloudflare 以外の環境（Vercel Edge 等）で SQLite 系 DB を使いたい場合の選択肢

### D1 vs Neon 詳細比較

| 観点 | D1 (SQLite) | Neon (PostgreSQL) |
|------|-------------|-------------------|
| トランザクション | `batch()` API で対応 | **フル対応** |
| 型システム | SQLite の緩い型 | **PostgreSQL の厳密な型** |
| 同時書き込み | 単一リージョン書き込み | **高スループット** |
| 複雑なクエリ | 限定的 | **JOIN・サブクエリが強力** |
| グローバル読み取り | レプリカ対応 | リードレプリカ対応 |
| 接続方式 | Binding（Workers ネイティブ） | Hyperdrive 経由 |

### コスト比較

**無料枠:**

| 項目 | D1 (Free) | Neon (Free) + Hyperdrive |
|------|-----------|--------------------------|
| 読み取り | 500万行/日 | 100 CU時間/月 |
| 書き込み | 10万行/日 | コンピュート時間に含む |
| ストレージ | **5GB** | 0.5GB |
| クエリ上限 | 制限なし | 10万/日（Hyperdrive） |

**有料プラン（小〜中規模アプリ）:**

| 項目 | D1 ($5/月) | Neon (~$15/月) + Workers Paid |
|------|-----------|-------------------------------|
| 月額合計 | **~$5** | **~$20** |
| 読み取り | 25億行/月含む | コンピュート時間次第 |
| ストレージ超過 | $0.75/GB | $0.35/GB |

D1 → Neon で月 $10〜30 程度のコスト増。

### Supabase の特徴

- PostgreSQL + Auth + Storage + Realtime + Edge Functions が統合
- Row Level Security (RLS) でアクセス制御
- 無料枠: 500MB DB, 1GB Storage, 50K MAU Auth
- Pro: $25/月（8GB DB, 100GB Storage）
- リアルタイム機能が必要な場合の第一候補

### 移行戦略: D1 → Neon

1. 初期は D1 で開発（コスト最小、セットアップ簡単）
2. PostgreSQL の機能が必要になったら Neon に移行
3. Drizzle ORM ならドライバー差し替えだけで移行可能

```ts
// D1 の場合
import { drizzle } from 'drizzle-orm/d1'
const db = drizzle(c.env.DB)

// Neon に移行する場合
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
const sql = neon(c.env.DATABASE_URL)
const db = drizzle(sql)

// スキーマ定義やクエリコードは変更不要
```

## ORM 比較: Drizzle vs Prisma

| 観点 | Drizzle ORM | Prisma |
|------|-------------|--------|
| D1 との相性 | **ネイティブサポート** | `@prisma/adapter-d1` が必要 |
| バンドルサイズ | **軽量** | 比較的重い（Workers の制限に当たりやすい） |
| マイグレーション | `drizzle-kit` で完結 | Wrangler + Prisma CLI の組み合わせ |
| Hono 公式 | **公式推奨スタック** | 対応するが手順が複雑 |
| 型安全性 | TypeScript ファースト | TypeScript 対応（コード生成） |
| 学習コスト | SQL に近い API | 独自の Query API |
| エコシステム | 成長中 | **成熟・プラグイン豊富** |

### プロダクション採用事例

- **Nani翻訳**（catnose99）: Drizzle ORM を採用。「Prismaより軽量なのが魅力。Naniではそこまで複雑なクエリは使わないので、Drizzleで十分快適」と評価 ([参考](https://zenn.dev/catnose99/articles/nani-translate))
- Drizzle は Edge/Serverless 環境でネイティブ互換。D1, Neon HTTP, Neon WebSocket, Turso, Bun SQLite 等の専用ドライバーを内蔵しており、接続プーリングの心配が不要（context7 公式ドキュメントより確認）

### 推奨

- Cloudflare 環境 → **Drizzle 一択**（D1 ネイティブ + 軽量）
- Vercel / GCP 環境 → **Drizzle 推奨**（Prisma も選択可）
- Supabase 環境 → **Drizzle + Supabase Client** 併用

## デプロイ先別 DB 推奨マトリクス

| デプロイ先 | シンプル CRUD | PostgreSQL 必要 | リアルタイム |
|-----------|-------------|----------------|------------|
| Cloudflare | **D1** | **Neon** (Hyperdrive) | **Supabase** (Hyperdrive) |
| Vercel | **Neon** | **Neon** | **Supabase** |
| GCP | **Neon** or Cloud SQL | **Neon** or Cloud SQL | **Supabase** |
