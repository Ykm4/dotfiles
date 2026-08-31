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

- DNS・Single Redirect の書き込みは `mise run cf:api`（website リポジトリ）に限定する。狭いトークン・書き込み `METHOD` の ask 承認・stderr の実行ログが揃った経路だからである。
- Cloudflare MCP の `execute` は読み取りに使う。GraphQL Analytics（Analytics Read 権限が要る）・ゾーン設定・Email Routing など、`cf:api` のトークンでは権限エラーになる領域はこちらで読む。
- MCP の `execute` は OAuth のスコープが広く、承認プロンプトなしで通る。書き込みには使わない。例外は両トークンで403になるゾーン設定と Email Routing だけ（詳細は website の `docs/design/domain-foundation/`）。
- `cf:admin`（Touch ID）は sandbox から 1Password デスクトップ連携に届かず実行できない。必要になったら `!` プレフィックスでの実行をユーザーへ依頼する。

## メール送信の規則

- Gmail の操作は gws-gmail 系スキルのヘルパー（`+read` `+reply` `+send` など）を使う。
- 生APIの組み立ては、ヘルパーに無い操作だけに限る。
- メール送信（`+send` `+reply` `+reply-all` `+forward`、生APIの messages send / drafts send）は、送信直前の文面と宛先をユーザーに提示し、明示の承認を得てから実行する。
- 確認プロンプトなしで送信できてしまう経路を見つけたら、使わずにユーザーへ報告する。
