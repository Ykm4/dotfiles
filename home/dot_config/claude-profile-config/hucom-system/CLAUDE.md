@~/.config/claude/_private/CLAUDE-common.md

## hucom-system プロファイル

自社業務の作業ディレクトリで有効になる。取引先案件は取引先ごとの client プロファイルが担う。対象ディレクトリの一覧は `_private/CLAUDE-common.md` にある。

この配下では gws と gcloud も `hucom-system` に固定される。切り替えは mise と direnv が行うため、`gws-profile` を手で呼ぶ必要はない。
