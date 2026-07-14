# フロントエンドフレームワーク選定

## 対象フレームワーク

React エコシステムのみ。Vue.js / Svelte 等は対象外。

- **Remix (React Router v7)**: Shopify 開発。Cloudflare ネイティブ対応
- **Next.js (App Router)**: Vercel 開発。最大のエコシステム

## デプロイ先別比較

### Cloudflare にデプロイする場合

| 観点 | Remix (React Router v7) | Next.js (VINEXT) | Next.js (OpenNext) |
|------|------------------------|-------------------|---------------------|
| Cloudflare 親和性 | **ネイティブ対応** | 新しい | アダプター変換 |
| 成熟度 | **数年のプロダクション実績** | 2025年発表直後 | バージョンアップで頻繁に破損 |
| 追従リスク | なし（自前API） | Next.js API への追従が必要 | Next.js 内部出力への追従が必要 |
| ビルド基盤 | Vite | Vite | Turbopack → 変換 |
| 開発元 | Shopify | Cloudflare | SST |

**推奨: Remix (React Router v7)**

理由:
- Cloudflare Workers でネイティブに動作
- Hono との統合が `remix-hono` で確立されている
- Vite ベースで高速ビルド
- 安定したプロダクション実績

### Vercel にデプロイする場合

| 観点 | Next.js (App Router) | Remix |
|------|---------------------|-------|
| Vercel 最適化 | **フル最適化** | 基本対応 |
| Server Components | **対応** | 対応予定 |
| ISR / SSG | **対応** | 限定的 |
| Preview Deploy | **自動最適化** | 対応 |
| エコシステム | **最大** | 成長中 |

**推奨: Next.js (App Router)**

理由:
- Vercel の最適化（ISR, Image Optimization, Analytics）をフル活用できる
- Server Components / Server Actions による最新のデータフェッチパターン
- 最大のエコシステム・コミュニティ

### GCP Cloud Run にデプロイする場合

どちらも問題なく動作。プロジェクトの好みで選択。

- **Next.js**: Docker イメージのデプロイガイドが豊富
- **Remix**: Express アダプターで標準的な Node.js サーバーとして動作

## Next.js on Cloudflare の詳細

### VINEXT（2025年、Cloudflare 開発）

- Next.js をラップするのではなく、Vite ベースで Next.js の API サーフェスを再実装
- ビルド時間 4.4倍高速、バンドルサイズ 57%削減
- **注意**: 発表直後で SSG 未実装など未成熟な部分あり
- 今後の成熟を待つか、Remix を選ぶかの判断が必要

### OpenNext（SST 開発）

- Next.js のビルド出力をリバースエンジニアリングして Workers 向けに変換
- Next.js のバージョンアップで内部出力が変わるたびに壊れるリスク
- 保守コストが高い → **非推奨**

## Hono + Remix 統合パターン

`remix-hono` パッケージで Remix を Hono のミドルウェアとして組み込む:

```ts
import { Hono } from 'hono'
import { remix } from 'remix-hono/handler'

const app = new Hono()

// Hono の API ルート（型安全な RPC）
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// 残りは Remix にフォールバック
app.use('*', remix({ build, mode: process.env.NODE_ENV }))
```

Hono RPC で API の型をフロントエンドと共有し、型安全な通信が可能。

## 選定フローチャート

```
Cloudflare にデプロイ?
  ├─ Yes → Remix (React Router v7) ※第一推奨
  │         Next.js (VINEXT) は成熟を待つ
  │
  └─ No → Vercel にデプロイ?
           ├─ Yes → Next.js (App Router)
           └─ No → GCP → Next.js or Remix（好みで）
```
