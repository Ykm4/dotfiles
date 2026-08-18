@~/.config/claude/_private/CLAUDE-common.md

## hucom プロファイル

`~/work/hucom/` の配下で有効になる。

この配下では gws と gcloud も `hucom` に固定される。切り替えは mise が行うため、`gws-profile` を手で呼ぶ必要はない。

## メール送信の規則

- Gmail の操作は gws-gmail 系スキルのヘルパー（`+read` `+reply` `+send` など）を使う。
- 生APIの組み立ては、ヘルパーに無い操作だけに限る。
- メール送信（`+send` `+reply` `+reply-all` `+forward`、生APIの messages send / drafts send）は、送信直前の文面と宛先をユーザーに提示し、明示の承認を得てから実行する。
- 確認プロンプトなしで送信できてしまう経路を見つけたら、使わずにユーザーへ報告する。
