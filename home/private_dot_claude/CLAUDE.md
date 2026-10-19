@~/.config/claude/_private/CLAUDE-common.md

## 既定プロファイル（~/.claude）

既定のプロファイル。取引先の作業ツリー（取引先ごとのプロファイルが担う）以外のすべてのディレクトリで有効になる。

この配下では gws とローカルの gcloud も `hucom-system` に固定される。切り替えは mise が行うため、`gws-profile` を手で呼ばない。

## Google のアカウントとプロジェクト

- アカウントは `yusuke.matsukuma@hucomsystem.com`、GCP プロジェクトは `hucomsystem-gws` である。
- gcloud はローカル CLI を直接使い、`--project=hucomsystem-gws`（プロジェクトに属さないコマンドは `--billing-project=hucomsystem-gws`）を付けて実行する。認証は `mise run google:gcloud-login hucom-system` で行う。
- 別のプロジェクトは、ユーザーが ID を明示したときだけ扱う。
- Google のドキュメント検索は google-dev-knowledge MCP を context7 より先に使う。
- gws の再認証は `mise run google:auth hucom-system` で行う。
