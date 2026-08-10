---
name: read-x
description: >-
  X(Twitter) のツイート/記事(Articles)のURLを開き、ログインゲートの先にある本文テキストを抽出して返す。
  agent-browser のログイン状態を ~/.config/x/x-auth.json に永続化するので、初回ログイン後は再ログイン不要。
  次のときに使う: x.com / twitter.com の URL（/status/... や /i/article/...）の本文が欲しいとき、
  「Xの記事を読んで」「このツイートの中身」「x.com のリンクの本文を取って」と言われたとき、
  WebFetch が 402 で弾かれる・SPA でログインが必要といった X 由来の取得失敗時に使用する。
  初回または期限切れ時のみ `/read-x login` で手動ログインが必要。
argument-hint: "[url | login]"
allowed-tools:
  - Bash(agent-browser:*)
  - Bash(mkdir:*)
  - Bash(chmod:*)
  - Bash(jq:*)
  - Bash(bash */read-x/scripts/read.sh*)
---

# read-x — X の本文をログイン状態で読む

X のツイートや「記事(Articles)」はログインゲートの内側にある。`WebFetch` は 402 で弾かれ、未ログインのブラウザではカードのプレビュー文しか取れない。このスキルは agent-browser のログイン状態を永続化し、その状態で URL を開いて本文を抽出する。

認証状態は `~/.config/x/x-auth.json`（`chmod 600`）に隔離する。これはログインセッション相当の秘密なので、中身を表示・コピー・コミットしてはいけない。

## 引数の振り分け

- `login` → 初回セットアップ（手動ログイン→状態保存）。下の「初回ログイン」を実行する。
- それ以外（URL） → 本文抽出。「本文を読む」を実行する。
- 引数が空で、直近の会話に x.com / twitter.com の URL があるなら、それを対象にする。

## 初回ログイン（`/read-x login`）

重要: 自動化ブラウザ（Chrome for Testing）で X のログインフローを踏むと、ボット検知で「ログインを一時的に制限しました」と弾かれる（実証済み）。また macOS では本物の Chrome の cookie は Keychain 暗号化されており `--profile` 流用では読めない。そのため、ユーザーが普段使うブラウザから cookie を書き出してもらい、それを取り込む。

手順:

1. 保存先を用意する。
   ```bash
   mkdir -p ~/.config/x && chmod 700 ~/.config/x
   ```
2. ユーザーに依頼する: 「普段 X にログインしているブラウザ（Chrome / Arc 等）で x.com を開き、cookie エクスポート拡張機能（Cookie-Editor 等）で JSON エクスポートしてください。**JSON はチャットに貼らず**、ファイル保存かクリップボードのままで合図をください」。
3. エクスポート結果をファイルに移す。中身は表示しない（cookie 名の一覧確認まではよい。値は出さない）。
   ```bash
   # ダウンロードファイルの場合
   mv <エクスポートファイル> ~/.config/x/cookies-export.json
   # クリップボードの場合
   pbpaste > ~/.config/x/cookies-export.json
   chmod 600 ~/.config/x/cookies-export.json
   # auth_token と ct0 が含まれるか名前だけ確認
   jq -r '[.[].name] | sort | join(", ")' ~/.config/x/cookies-export.json
   ```
4. 取り込んでログイン確認し、状態を保存する。`/home` に留まれば認証済み、`x.com/` に飛ばされたら失敗。
   ```bash
   agent-browser close --all
   agent-browser open about:blank
   agent-browser cookies set --curl ~/.config/x/cookies-export.json --domain x.com
   agent-browser open https://x.com/home
   agent-browser wait --load networkidle
   agent-browser get url   # → https://x.com/home なら成功
   agent-browser state save ~/.config/x/x-auth.json
   chmod 600 ~/.config/x/x-auth.json
   rm ~/.config/x/cookies-export.json   # 生エクスポートは必ず削除
   agent-browser close
   ```
5. 保存できたら「ログイン状態を保存しました。以降は `/read-x <url>` で再ログイン不要です。エクスポートに使った拡張機能は無効化を推奨します」と伝える。

## 本文を読む（`/read-x <url>`）

抽出スクリプトを使う。決定的な多段処理（URL種別判定・記事カードの追跡・本文抽出）をまとめてある。

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/read.sh "<url>"
```

スクリプトは本文を標準出力に印字する。終了コードと特別な出力で状態を返すので、それに応じて対応する。

- 正常 → 本文がそのまま出力される。抜けや文字化けがなければそのままユーザーに渡す。
- `NOT_LOGGED_IN`（exit 3） → 未ログイン。「先に `/read-x login` を実行してください」と案内する。
- `SESSION_EXPIRED`（exit 4） → セッション切れ。「ログインの有効期限が切れています。`/read-x login` で再ログインしてください」と案内する。
- `EXTRACT_FAILED`（exit 5） → ページは開けたが本文セレクタに当たらなかった。下の「抽出に失敗したら」へ。
- `BROWSER_ERROR`（exit 6） → ブラウザ/daemon が応答しない。スクリプトが固まった daemon を排除済みなので、そのままもう一度実行すれば大抵直る。再発するなら `agent-browser doctor` を実行する。

### 抽出に失敗したら

X の DOM は変わりうるので、スクリプトの本文セレクタが外れることがある。その場合は agent-browser を直接駆動して中身を確かめる。

```bash
agent-browser --state ~/.config/x/x-auth.json open "<url>"
agent-browser wait --load networkidle
agent-browser snapshot -i -u          # 構造と /i/article/ への記事リンクを確認
# 記事リンク(/i/article/...)があれば、その URL を open し直してから本文を取る
agent-browser get text "article"      # もしくは本文コンテナを get text / eval で対象指定
agent-browser close
```

うまく取れたセレクタが分かったら、`scripts/read.sh` の候補セレクタに反映して次回以降を安定させる。詳しい仕組みと調整箇所は [reference.md](reference.md) を参照する。

## 注意

- これは「自分のログイン済みビューで公開コンテンツを読む」自動化。X の自動化規約上ゼロリスクではないので、常識的な低頻度の利用に留める。
- `~/.config/x/x-auth.json` はログインセッションそのもの。漏れると乗っ取り相当。表示・共有・git 追加をしない。`chmod 600` を維持する。
