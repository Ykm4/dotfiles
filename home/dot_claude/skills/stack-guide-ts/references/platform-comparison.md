# プラットフォーム比較: Cloudflare vs Vercel vs GCP

## 料金比較

### 無料プラン

| 項目 | Cloudflare Workers (Free) | Vercel (Hobby) | GCP Cloud Run (Free Tier) |
|------|--------------------------|----------------|--------------------------|
| リクエスト数 | 10万/日 | 100万/月（Functions） | 200万/月 |
| CPU時間 | 10ms/リクエスト | 4時間/月 | 180,000 vCPU-秒/月 |
| データ転送 | **無制限（エグレス無料）** | 100GB/月 | 1GB/月（北米） |
| DB | D1: 読み500万行/日, 書き10万行/日, 5GB | なし（別途契約） | なし（別途 Cloud SQL 等） |
| KV/ストレージ | KV: 10万読み取り/日, 1GB | Blob: 1GB | なし（別途 GCS） |
| 商用利用 | **可** | **不可**（個人・非商用のみ） | 可 |

### 有料プラン

| 項目 | Cloudflare Workers Paid ($5/月) | Vercel Pro ($20/ユーザー/月) | GCP Cloud Run (従量課金) |
|------|-------------------------------|---------------------------|------------------------|
| リクエスト数 | 1,000万/月含む | 100万/月含む | 従量課金 |
| CPU時間 | 3,000万ms/月含む | 従量課金 | $0.000024/vCPU-秒 |
| データ転送 | **無制限（エグレス無料）** | 1TB/月 | $0.12/GB |
| DB | D1: 読み25億行/月含む | - | Cloud SQL: ~$7/月〜 |
| ストレージ | R2: 10GB含む、エグレス無料 | - | GCS: $0.02/GB/月 |
| チーム課金 | なし | **ユーザーごとに $20** | なし |

## 特徴比較

| 観点 | Cloudflare | Vercel | GCP Cloud Run |
|------|-----------|--------|---------------|
| ランタイム | V8 isolate (workerd) | Node.js / Edge Runtime | コンテナ (Docker) |
| コールドスタート | **なし（0ms）** | あり（Edge は軽微） | あり（数百ms〜数秒） |
| エッジ実行 | **全リクエスト** | Edge Functions のみ | リージョン単位 |
| Node.js 互換 | 制限あり（`fs` 等不可） | **フル対応** | **フル対応** |
| WebSocket | Durable Objects で対応 | なし | 対応 |
| 最大実行時間 | 30秒（Free）/ 15分（Paid） | 10秒（Hobby）/ 5分（Pro） | 60分 |
| カスタムドメイン | 無料 | 無料 | 要 Load Balancer |

## Workers Static Assets（Pages → Workers 統合）

新規プロジェクトでは **Pages ではなく Workers を使うべき**（公式推奨）。Workers Static Assets により、静的アセット配信と API ロジックを単一の Worker で統合できる。

- Pages は引き続き動作するが、**新機能・最適化は Workers に集中**
- `env.ASSETS.fetch(request)` で静的ファイルを配信
- `wrangler.toml` の `[assets]` セクションで設定

```toml
# wrangler.toml
name = "my-app"
main = "./worker/index.ts"

[assets]
directory = "./dist/client/"
binding = "ASSETS"
```

([参考: Cloudflare Workers 公式ドキュメント](https://developers.cloudflare.com/workers/static-assets))

## セキュリティ（無料プランに含む）

Cloudflare は無料プランでもセキュリティ機能が充実しており、AWS や GitHub Pages では有料または不可能な機能が含まれる。

| 機能 | Cloudflare (Free) | AWS (Amplify + CloudFront) | GitHub Pages |
|------|-------------------|---------------------------|-------------|
| WAF | **無料で利用可** | Bot Control 月額$10+従量課金 | 不可 |
| ボット対策 | **無料で利用可** | 有料 | 不可 |
| AI クローラー対策 | **AI Labyrinth** | なし | なし |
| DDoS 防御 | **自動・無料** | Shield Standard のみ | 限定的 |
| HTTP/3 | **対応** | 対応 | 非対応 |
| 0-RTT 再接続 | **対応**（再訪問時の高速化） | なし | なし |
| Speed Brain | **対応**（ページ先読み） | なし | なし |

- AI Labyrinth: AI クローラーに偽コンテンツを提供し、データ汚染を誘導する独自機能
- セキュリティ設定はダッシュボードのトグルひとつで有効化

([参考: Cloudflareの無料セキュリティ機能](https://zenn.dev/yostos/articles/cloudflare-benefits))

## 選定ガイド

### Cloudflare を選ぶべき場合

- コストを最小限に抑えたい（エグレス無料が最大の武器）
- エッジでの高速レスポンスが重要
- D1 + R2 + KV のエコシステムを活用したい
- 商用サービスを無料枠で始めたい
- Docker / コンテナ管理から解放されたい（`wrangler deploy` のみ）
- セキュリティを自動で解決したい（WAF・DDoS・ボット対策が無料）
- Worker 単位でサービスを責務分離したい（HP / 管理画面 / API を別 Worker に分割）

### Vercel を選ぶべき場合

- Next.js をフル活用したい（最も最適化された環境）
- Preview Deploy + チームコラボレーション機能が重要
- Node.js API のフル互換が必要
- 小規模チーム（ユーザー課金のコストが許容範囲）

### GCP Cloud Run を選ぶべき場合

- 既存の GCP リソース（BigQuery, Cloud SQL 等）と連携したい
- Docker コンテナの柔軟性が必要
- 長時間実行タスク（バッチ処理等）がある
- Node.js 以外のランタイムも使いたい

## 注意点

- Vercel の無料プランは商用不可。MVP でも商用なら Cloudflare か GCP
- Vercel はチーム拡大でコストが急増（$20/ユーザー/月）
- Cloudflare Workers は Node.js API の一部が使えない（`fs`, `child_process` 等）
- GCP はセットアップが最も複雑（IAM, VPC, Load Balancer 等）

## 採用事例・コスト実績

- AWS でホスティングしていた Web サービスを Cloudflare に移行し、年間コストが **¥1,500**（ドメイン代のみ）に削減された事例あり ([参考](https://zenn.dev/helloworld/articles/b42240ad018a51))
- 無料プランで商用利用可能なため、MVP・スタートアップのコスト障壁が極めて低い
