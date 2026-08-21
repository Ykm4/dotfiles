@~/.config/claude/_private/CLAUDE-common.md

## hucom-system プロファイル

自社業務の作業ディレクトリで有効になる。取引先案件は取引先ごとの client プロファイルが担う。

この配下では gws とローカルの gcloud も `hucom-system` に固定される。切り替えは mise が行うため、`gws-profile` を手で呼ばない。

## Google のアカウントとプロジェクト

- アカウントは `yusuke.matsukuma@hucomsystem.com`、GCP プロジェクトは `hucomsystem-gws` である。
- google-cloud-cli MCP は `project` に `projects/hucomsystem-gws` を渡し、gcloud コマンドに `--project=hucomsystem-gws`（プロジェクトに属さないコマンドは `--billing-project=hucomsystem-gws`）を付けて実行する。
- 別のプロジェクトは、ユーザーが ID を明示したときだけ扱う。
- Google のドキュメント検索は google-dev-knowledge MCP を context7 より先に使う。
- gws の再認証は `mise run google:auth hucom-system` で行う。
