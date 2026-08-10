# read-x リファレンス

SKILL.md の補足。仕組みの詳細と、抽出が外れたときの調整箇所をまとめる。

## なぜブラウザ経由なのか

X のツイート・記事はログインゲートの内側にある。

- `WebFetch` は X に対して HTTP 402（Payment Required）で弾かれる。
- 未ログインのブラウザで開くと、記事(Articles)はカードのプレビュー文（タイトル＋書き出し数行）しか出ず、本文は登録/ログイン誘導に置き換わる。
- 公式 X API は有料（無料枠廃止・従量課金）で、かつ記事(Articles)本文は API にまともに露出していない。

そのため「ログイン済みブラウザで本物のページを開いて本文を読む」のが、無料で本文まで確実に取れる唯一の現実解になっている。

## 認証状態の永続化

agent-browser の状態保存を使う。

- `agent-browser state save <path>` … 現在の cookie + localStorage を JSON に保存。
- `agent-browser --state <path> open <url>` … 保存した状態を読み込んでログイン済みで起動。

保存先は `~/.config/x/x-auth.json`（`chmod 600`）。`~/.config/agent-browser/`（ツール自身の管理領域）とは分け、X 認証として中立な場所に置く。中身は agent-browser の state 形式なので、別ツールへ乗り換える場合は再ログインが要る。

環境変数 `X_AUTH_STATE` を設定すれば保存先を上書きできる（複数アカウント運用など）。

## 初回取り込みで通らない方法（実証済みの落とし穴）

- 自動化ブラウザで X のログインフォームを踏む → ボット検知で「ログインを一時的に制限しました」と弾かれる。Chrome for Testing はログイン/サインアップで特に強く検知される。
- macOS で `--profile <本物のChromeプロファイル>` を流用 → Chrome の cookie は Keychain 鍵で暗号化されており、Chrome for Testing からは復号できず未ログイン表示になる。ログイン済みプロファイルでも判別不能。

通る方法は SKILL.md の手順（実ブラウザから cookie を JSON エクスポート → `cookies set --curl` で投入 → `state save`）。実ブラウザを閉じる必要がなく、Arc など Chrome 以外でもよい。

## セッションの寿命

期限を決めるのは X 側のセッション cookie（`auth_token`）で、長寿命（実用上は数か月〜年単位）。失効するのは、X からログアウトした、パスワードを変更した、X 側がセッションを無効化した等のイベント時。`SESSION_EXPIRED` が返ったら初回ログイン手順をやり直す。

## URL 種別と抽出フロー（scripts/read.sh）

1. `--state` で URL を開き、`wait --load networkidle` で描画を待つ。
2. 現在 URL がログイン/フロー系（`/i/flow/login`、`/login`、`/i/jf/` 等）なら期限切れと判断し `SESSION_EXPIRED` を返す。
3. URL が `/status/...` で記事カードを含む場合、`a[href*="/i/article/"]` を辿って記事ページを開き直す。`/i/article/...` を直接渡された場合はそのまま。
4. 本文抽出は特定セレクタに依存しすぎないよう、候補ブロックの中から最長 innerText を採用する。

## 抽出セレクタの調整

X の DOM はたびたび変わるので、本文が取れない（`EXTRACT_FAILED`）ときは候補セレクタを見直す。`scripts/read.sh` の本文抽出 eval にある配列が調整ポイント。

現在の候補:

- `[data-testid="tweetText"]` … 通常ツイートの本文
- `article` / `[role="article"]` … 記事・ツイートの外枠
- `main` … 最後の砦

実地で当たりのセレクタが判明したら、配列の先頭に足すと安定する。確認手段:

```bash
agent-browser --state ~/.config/x/x-auth.json open "<url>"
agent-browser wait --load networkidle
agent-browser snapshot -i -u     # 構造を見る
agent-browser get html "main"    # 本文コンテナの data-testid 等を特定
agent-browser close
```

## eval 戻り値の整形

`agent-browser eval` は文字列を JSON エンコード（前後にダブルクオート）して返すことがある。`read.sh` は末尾で前後のダブルクオートを 1 組だけ剥がしている。改行や記事内の引用符はそのまま保持する方針。

## ハング対策（read.sh 内蔵）

古い daemon プロセスが残っていると、agent-browser の `eval` 等が永遠に返らないことがある（実証済み）。read.sh は次の対策を内蔵している。

- 全 agent-browser 呼び出しに `perl -e 'alarm shift; exec @ARGV'` 方式のタイムアウト（既定45秒、`AB_TIMEOUT` で変更可）を掛ける。macOS 標準環境で動く portable timeout。
- 開始時に応答確認（8秒）を行い、シグナル死（exit >=128）＝ハングなら daemon を `pkill` してクリーンに作り直す。
- `open` 後に URL が取得できなければ `BROWSER_ERROR`（exit 6）で即時失敗し、daemon を排除して終了する。再実行すれば新しい daemon で立ち上がる。

## トラブルシュート

- `BROWSER_ERROR`（exit 6）→ 固まった daemon は排除済み。もう一度実行する。再発するなら `agent-browser doctor`。
- daemon 接続エラーや `Unknown command` → `agent-browser doctor` を先に実行。
- ヘッドレスで本文が出ないが headed だと出る → 描画待ちが足りない可能性。`wait --text` で本文中の既知語を待つ、または `wait 1500` を一時的に挟んで切り分ける。
- 何度も期限切れになる → X 側のセッション失効。`/read-x login` をやり直す。頻発するなら `--session-name` 方式（agent-browser 管理の自動 save/restore）への切り替えも検討。
