@~/.config/claude/_private/CLAUDE-common.md

## hucom プロファイル

`~/work/hucom/` の配下で有効になる。

この配下では gws とローカルの gcloud も `hucom` に固定される。切り替えは mise が行うため、`gws-profile` を手で呼ばない。

## Google のアカウントとプロジェクト

- アカウントは `hucom@hucom.biz`、GCP プロジェクトは `hucom-gws` である。
- google-cloud-cli MCP は `project` に `projects/hucom-gws` を渡し、gcloud コマンドに `--project=hucom-gws`（プロジェクトに属さないコマンドは `--billing-project=hucom-gws`）を付けて実行する。
- 別のプロジェクトは、ユーザーが ID を明示したときだけ扱う。
- Google のドキュメント検索は google-dev-knowledge MCP を context7 より先に使う。
- gws の再認証は `mise run google:auth hucom` で行う。

## Cloudflare の操作の使い分け

- 読み取りと探索は Cloudflare MCP（`search` `execute` `docs`）か公式 `cf` CLI の list/get を使う。
- DNS レコードの書き込みは公式 `cf` CLI を直接呼ぶ（`cf dns records create|update|delete -z <ドメイン名> --body '<JSON>'`）。認証は website リポジトリのディレクトリに紐付けた OAuth プロファイル `dns`（スコープは `dns_records:read` `dns_records:edit` `zone:read` `account:read` `user:read`）で、書き込みは permission の既定どおり承認プロンプトを通る。`CLOUDFLARE_API_TOKEN` を環境に置かない（プロファイルより優先され、警告なしに別アカウントへ届く）。
- `cf` の OAuth にスコープが無い書き込み（Single Redirect・ゾーン設定・Email Routing・Workers Builds の接続・Access・D1・KV）は MCP の `execute` で行う。MCP は承認プロンプトなしで通るので、実行前に内容をユーザーへ示して承認を得る。
- `cf` は傘 `~/work/hucom/mise.toml` の `[tools]` で版を固定している（技術プレビューのため）。`mise x npm:cf` で別の版を呼ばない。
- アカウント管理（メンバー・課金）はユーザーがダッシュボードで行う。代行しない。
- 経緯と permission の決まりは website の `docs/design/agent-tooling/agent-tooling.md` にある。

## メール送信の規則

- Gmail の操作は gws-gmail 系スキルのヘルパー（`+read` `+reply` `+send` など）を使う。
- 生APIの組み立ては、ヘルパーに無い操作だけに限る。
- メール送信（`+send` `+reply` `+reply-all` `+forward`、生APIの messages send / drafts send）は、送信直前の文面と宛先をユーザーに提示し、明示の承認を得てから実行する。
- 確認プロンプトなしで送信できてしまう経路を見つけたら、使わずにユーザーへ報告する。
