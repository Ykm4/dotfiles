# 認証ソリューション選定

## 候補一覧

| ソリューション | モデル | 特徴 | 最適なケース |
|--------------|--------|------|------------|
| Clerk | ホスティッド | UI コンポーネント付き。SSO 対応 | 最速セットアップ・エンタープライズ |
| Auth.js (v5) | セルフホスト | 旧 NextAuth。柔軟な DB アダプター | Next.js・カスタマイズ重視 |
| Lucia | セルフホスト | 軽量。DB スキーマを完全制御 | 最大限のコントロール |
| Supabase Auth | ホスティッド | Supabase 統合。RLS 連携 | Supabase 採用時 |

## 詳細比較

### Clerk

- **料金**: 10,000 MAU まで無料、以降 $0.02/MAU
- **UI**: React コンポーネント（`<SignIn />`, `<UserButton />`）付属
- **SSO**: SAML / OIDC 対応（Pro プラン $25/月〜）
- **ソーシャル**: Google, GitHub, Apple 等 20+ プロバイダー
- **Workers 対応**: `@clerk/backend` が Cloudflare Workers で動作
- **Remix 対応**: `@clerk/remix` 公式パッケージあり
- **Next.js 対応**: `@clerk/nextjs` 公式パッケージあり

**メリット**: セットアップが最速。UI を自前で作る必要なし
**デメリット**: ベンダーロックイン。MAU 増加でコスト増

### Auth.js (v5)

- **料金**: 無料（OSS）
- **DB アダプター**: Drizzle, Prisma, Supabase 等多数
- **ソーシャル**: 80+ プロバイダー対応
- **セッション**: JWT / Database セッション選択可
- **Workers 対応**: `@auth/core` が Workers で動作（一部制限あり）
- **Remix 対応**: `remix-auth` + Auth.js プロバイダー
- **Next.js 対応**: `next-auth` として最も成熟

**メリット**: 柔軟性が高い。DB に認証データを保持できる
**デメリット**: Clerk より初期セットアップに時間がかかる

### Lucia

- **料金**: 無料（OSS）
- **特徴**: 認証ライブラリではなく認証ヘルパー。セッション管理に特化
- **DB**: 任意の DB + ORM で認証テーブルを管理
- **Workers 対応**: Web 標準 API のみ使用。Workers で動作
- **制御**: DB スキーマ・セッション管理を完全にコントロール

**メリット**: 最小限の抽象化。ベンダーロックインなし
**デメリット**: UI・ソーシャルログインは自前実装。学習コスト高

### Supabase Auth

- **料金**: Supabase に含まれる（50K MAU まで無料）
- **RLS 連携**: Row Level Security で認証ユーザーに基づくアクセス制御
- **ソーシャル**: Google, GitHub, Apple 等対応
- **マジックリンク**: メールベースのパスワードレス認証
- **Workers 対応**: `@supabase/supabase-js` 経由で利用可

**メリット**: Supabase エコシステムと統合済み
**デメリット**: Supabase に依存。単体利用は非推奨

## 選定マトリクス

| 要件 | 推奨 | 理由 |
|------|------|------|
| 最速セットアップ | **Clerk** | UI コンポーネント付き |
| ソーシャルログインのみ | **Clerk** | 設定だけで完了 |
| メール + パスワード | **Auth.js** | DB アダプターで柔軟 |
| エンタープライズ SSO | **Clerk** | SAML/OIDC 内蔵 |
| 最大限の制御 | **Lucia** | DB スキーマを自分で設計 |
| Supabase 採用済み | **Supabase Auth** | エコシステム統合 |
| コスト最小（大規模） | **Auth.js** or **Lucia** | OSS で MAU 課金なし |

## Cloudflare Workers での注意点

- Clerk: `@clerk/backend` は Workers 対応済み
- Auth.js: `@auth/core` は Workers で動作するが、一部 DB アダプターが Node.js 依存の場合あり。Drizzle adapter は Workers OK
- Lucia: Web 標準 API のみなので Workers で問題なし
- Supabase Auth: `@supabase/supabase-js` は Workers 対応済み
