# 開発ツール & インフラ選定

## テスト

### 推奨構成

| レイヤー | ツール | 用途 |
|---------|--------|------|
| ユニット / 統合 | **Vitest** | TS ファースト。Vite ネイティブ |
| コンポーネント | **Testing Library** | React コンポーネントテスト |
| E2E | **Playwright** | クロスブラウザ。自動待機 |

### Vitest

- Vite ベースで設定不要（Remix / Next.js の Vite 設定を共有）
- Jest 互換 API で移行が容易
- TypeScript ネイティブ（トランスパイル不要）
- ワークスペース対応（モノレポ）

### Testing Library

- `@testing-library/react`: React コンポーネントテスト
- `@testing-library/user-event`: ユーザー操作シミュレーション
- DOM テスト重視（実装詳細に依存しない）

### Playwright

- クロスブラウザ（Chromium / Firefox / WebKit）
- 自動待機・リトライ
- `@playwright/test` でテストランナー統合
- CI での並列実行対応

## CI/CD

### GitHub Actions（推奨）

全プラットフォームで利用可能。

**基本ワークフロー:**

```yaml
name: CI
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2  # or pnpm/action-setup
      - run: bun install
      - run: bun run lint
      - run: bun run typecheck
      - run: bun run test
```

**デプロイ:**

| プラットフォーム | デプロイ方法 |
|----------------|------------|
| Cloudflare | `wrangler deploy`（GitHub Actions で実行） |
| Vercel | Git push で自動デプロイ（Vercel 側で設定） |
| GCP | `gcloud run deploy` or Cloud Build |

**Preview Deploy:**

- Cloudflare Workers: PR ごとに自動プレビュー URL 生成（Workers Static Assets）
- Vercel: PR ごとに自動プレビュー URL 生成
- GCP: Cloud Run revision で手動設定が必要

## モノレポ

### 判断基準

| 条件 | 推奨 |
|------|------|
| 個人開発 / 単一プロジェクト | **不要** |
| フロント + バックエンドで分離 | **pnpm workspaces** |
| チーム開発 / 複数パッケージ | **Turborepo** |

### Turborepo

- タスクキャッシュ（ビルド・テスト結果をキャッシュ）
- 並列実行（依存グラフに基づく）
- Remote Cache（チーム間でキャッシュ共有）
- Vercel が開発元

### pnpm workspaces

- シンプルなワークスペース管理
- 追加ツール不要
- `pnpm --filter <package> run build` で個別実行

## パッケージマネージャー / ランタイム

### 比較

| 観点 | Bun | pnpm | npm |
|------|-----|------|-----|
| インストール速度 | **最速** | 高速 | 標準 |
| ランタイム | **内蔵** | なし | なし |
| エコシステム互換 | 一部非互換あり | **最も安定** | 安定 |
| ロックファイル | bun.lockb (binary) | pnpm-lock.yaml | package-lock.json |
| ワークスペース | 対応 | **最も成熟** | 対応 |

### 推奨

| 条件 | 推奨 |
|------|------|
| Cloudflare + 個人開発 | **Bun** |
| Cloudflare + チーム開発 | **pnpm**（安定性重視） |
| Vercel | **pnpm** |
| GCP | **pnpm** |

### 注意点

- Cloudflare Workers の本番ランタイムは `workerd`（V8 isolate）
- パッケージマネージャーの選択は本番に影響しない
- **Bun 固有 API（`Bun.file()` 等）をアプリコードで使わない**こと
  - Workers にデプロイできなくなる
- `bunx wrangler` で Wrangler も動作する

## CSS / スタイリング

主要な選択肢（参考）:

| ツール | 特徴 |
|--------|------|
| Tailwind CSS | ユーティリティファースト。最も人気 |
| CSS Modules | ゼロランタイム。フレームワーク組み込み |
| Panda CSS | 型安全・ゼロランタイム CSS-in-JS |

## 推奨 Claude Code スキル（Cloudflare 開発）

Cloudflare 公式の Claude Code スキルを導入すると、Cloudflare リソースの操作・設計パターンを Claude が適切にガイドする。

| スキル | 用途 | 導入タイミング |
|--------|------|-------------|
| **wrangler** | Workers/D1/R2/KV の開発・デプロイ・型生成 | Cloudflare 開発時（ほぼ必須） |
| **durable-objects** | ステートフル協調・WebSocket・RPC パターン | リアルタイム機能の実装時 |
| **agents-sdk** | AI エージェント構築（状態管理・MCP サーバー） | AI 機能の実装時 |

インストール:
```bash
skills add cloudflare/skills -g -s wrangler durable-objects agents-sdk -y
```

更新: `skills update` で全スキルを一括更新
