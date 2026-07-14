---
name: review-pr-comments
description: PR の未解決レビューコメントを取得して処理するスキル。Copilot からの inline コメントは判断→自動修正→検証まで行い、commit / push / resolve はユーザーの明示指示後に実行する。人間からの inline コメントは対応方針を提示するのみで自動修正は行わない。`/review-pr-comments [PR番号]` で起動し、引数省略時は current branch から PR を自動特定する。「PRレビュー対応」「Copilot コメント対応」「レビューコメント確認」「未解決コメント」「PR コメント」と言われたとき、または PR レビュー対応を始めるときに使用する。
allowed-tools:
  - Bash(gh *)
  - Bash(mise *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git push *)
  - Bash(git status *)
  - Bash(git diff *)
  - Bash(git log *)
  - Bash(jq *)
  - Bash(/Users/ykm4/.claude/skills/review-pr-comments/scripts/fetch-unresolved-threads.sh *)
  - Bash(/Users/ykm4/.claude/skills/review-pr-comments/scripts/resolve-thread.sh *)
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Skill
---

# Review PR Comments

## 概要

GitHub PR の未解決 inline review コメントを処理する。Copilot からのコメントは判断→自動修正→検証まで行い、commit / push / resolve はユーザーの明示指示後に実行する（自動ではコミットしない）。人間からのコメントは対応方針の提示のみ（自動修正・コミット・resolve は行わない）。

## 重要な前提

- **対応判断ロジック**は `superpowers:receiving-code-review` スキルに従う。各コメントを評価する前に Skill ツールでこのスキルを必ず読み込む。
- **対象は inline review comment のみ**。PR 全体への一般コメント（issue comment）や review summary は対象外。
- **未解決スレッドのみ**を処理する（`isResolved == true` のスレッドは無視）。
- **outdated スレッドの扱い**: 既に該当箇所が変更されたコメントも未解決なら対象に含める。判断ロジックで「対応不要」となればコード修正はせず resolve 対象として扱う（実際の resolve は Step 8 でユーザー指示後に実行する）。
- **スレッド返信は不要**。コメント内容に対する文章での返信は行わない。
- **gh コマンドのオプション差分**: 本スキルが利用する `gh api graphql` / `gh pr view` / `gh repo view` は枯れた API なのでハードコーディング前提。万一 `unrecognized flag` 等のエラーが出たら、該当サブコマンドを `gh <subcommand> --help` で確認して現行オプションに合わせて再実行する。

## ワークフロー

### Step 1: 引数を解析して対象を特定する

引数の形式によって処理対象を切り替える。

| 引数 | owner / name / PR | 対象スレッド |
|------|-------------------|-------------|
| (省略) | current branch から `gh pr view` で自動特定 | PR の全未解決スレッド |
| `<PR番号>` | current repo (`gh repo view`) + 指定番号 | PR の全未解決スレッド |
| `https://github.com/<owner>/<name>/pull/<N>` | URL から抽出 | PR の全未解決スレッド |
| `https://github.com/<owner>/<name>/pull/<N>#discussion_r<comment_id>` | URL から抽出 | 該当コメントを含む 1 スレッドのみ |

URL パターン解析:

```bash
TARGET_COMMENT_DB_ID=""  # 空ならスレッド全件対象

if [[ "$ARG" =~ ^https://github.com/([^/]+)/([^/]+)/pull/([0-9]+)(#discussion_r([0-9]+))?$ ]]; then
  OWNER="${BASH_REMATCH[1]}"
  NAME="${BASH_REMATCH[2]}"
  PR_NUMBER="${BASH_REMATCH[3]}"
  TARGET_COMMENT_DB_ID="${BASH_REMATCH[5]}"
elif [[ "$ARG" =~ ^[0-9]+$ ]]; then
  PR_NUMBER="$ARG"
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
  OWNER="${REPO%/*}"
  NAME="${REPO#*/}"
else
  PR_NUMBER="$(gh pr view --json number -q .number)"
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
  OWNER="${REPO%/*}"
  NAME="${REPO#*/}"
fi
```

**注意**: URL 渡し以外（PR 番号 or 省略）の場合、`gh repo view` / `gh pr view` は cwd に依存する。current branch の repo と対象 PR の repo が異なる場合は URL 渡しを必須とする。

`TARGET_COMMENT_DB_ID` がセットされている場合は、Step 2 取得後に該当スレッドのみ抽出する:

```bash
THREADS="$(echo "$THREADS" | jq --argjson tid "$TARGET_COMMENT_DB_ID" \
  '[.[] | select(.comments.nodes[] | .databaseId == $tid)]')"
```

### Step 2: 未解決レビュースレッドを取得

`scripts/fetch-unresolved-threads.sh` で未解決スレッド一覧を取得する。

```bash
${CLAUDE_SKILL_DIR}/scripts/fetch-unresolved-threads.sh "$OWNER" "$NAME" "$PR_NUMBER"
```

返り値は `[{ id, isOutdated, path, comments: [...] }]` の JSON 配列。各スレッドの `id`（GraphQL node ID）は後の resolve で使う。100 件超の thread を持つ PR ではスクリプトを拡張する必要がある。

### Step 3: 仕分け

各スレッドの**最初のコメントの投稿者**で判定する。

- `author.login` が `Copilot`、`copilot-pull-request-reviewer`、または `copilot` を含む `[bot]` 系ユーザー → **Copilot モード**
- それ以外（人間レビュアー、その他の bot）→ **人間モード**

```bash
# 仕分け例
echo "$THREADS" | jq '
  map({
    id,
    isOutdated,
    firstAuthor: .comments.nodes[0].author.login,
    mode: (
      if (.comments.nodes[0].author.login | test("(?i)copilot"))
      then "copilot"
      else "human"
      end
    ),
    comments: .comments.nodes
  })
'
```

### Step 4: `superpowers:receiving-code-review` を読み込む

判断フェーズに入る前に、Skill ツールで以下を読み込む。

```
Skill: superpowers:receiving-code-review
```

このスキルが提供する評価フレームワーク（VERIFY → EVALUATE → RESPOND → IMPLEMENT、YAGNI チェック、push back の判断基準）を全コメントの判断に適用する。

### Step 5a: Copilot モード（判断→修正）

各 Copilot スレッドについて：

1. コメント本文・対象ファイル/行・diff hunk を読み、`receiving-code-review` のロジックで「対応する / 対応しない」を判定する。
2. 判定結果を一覧として保持する（後でサマリ出力 & resolve に使う）。
3. 「対応する」と判定したものは、Edit/Write ツールで実際にコードを修正する。
4. 全 Copilot スレッドの判定・修正が完了したら次の Step へ進む（コメント毎に commit/push しない）。

**このスキルは commit / push / resolve を自動実行しない（Step 7・Step 8 参照）。修正はワーキングツリーへの適用までで止める**。

### Step 5b: 人間モード（提案のみ）

各人間スレッドについて：

1. コメント本文・対象ファイル/行・diff hunk を読み、`receiving-code-review` のロジックで判断する。
2. 「対応が必要」と判定したものは、**最適な修正方針**（変更すべきファイル・行・修正内容の要約）をユーザーへ提示する。
3. 自動でコードを修正しない。コミット・push・resolve も行わない。

ユーザーが個別に「この提案を適用して」と指示するまで待機する。

### Step 6: 検証（Copilot 自動修正がある場合のみ）

Copilot コメントへの自動修正を行った場合、提示前に以下を実行する。

```bash
mise run typecheck
mise run lint
```

- いずれかが**失敗したら commit / push / resolve を実行せず**、ユーザーへ失敗内容を報告して停止する。
- 成功したら Step 7（提示して停止）へ進む。

プロジェクトに `mise` タスクが存在しない場合は、`package.json` 等から typecheck / lint コマンドを特定して同等のコマンドを実行する。

### Step 7: 修正内容を提示して停止する（commit は自動で行わない）

プロジェクトの運用ルール（`CLAUDE.md`「コミットはユーザーの明示的な指示があるまで実行しない」）に従い、本スキルは commit / push / resolve を**自動実行しない**。

Copilot 自動修正がある場合は、ここで次を提示して**停止する**。

- 適用した修正の一覧（1 コメント = 1 行、対象 `file:line` と修正概要）
- typecheck / lint の結果（PASS / FAIL）
- commit / push / resolve はユーザーの指示後に実行する旨

提示フォーマットは Step 9 のサマリに準じる（この時点では「コミット: 未実施（承認待ち）」と記す）。

**ユーザーが commit を指示するまで Step 8 に進まない**。「コミットしてよいですか」と問い返さず、報告にとどめる（CLAUDE.md「都度確認もしない」に従う）。

### Step 8: コミット & push & resolve（ユーザーが commit を指示した後のみ）

ユーザーから commit の明示指示があったら、以下をまとめて実行する。

```bash
# 1. 全 Copilot 修正をまとめて 1 コミットにする
git add -u  # 修正対象が untracked になることは通常ないため -u で十分
git commit -m "$(cat <<'EOF'
Copilot レビュー指摘対応

- (対応した内容を箇条書きで記載)
- (1 コメント = 1 行)
- (例: src/foo.ts:42 の null チェック漏れを修正)
EOF
)"
git push

# 2. resolve（Copilot スレッドのうち「対応した」「対応不要」のみ。push back は除く）
${CLAUDE_SKILL_DIR}/scripts/resolve-thread.sh "$THREAD_ID"  # スレッドごとに 1 回
```

- 箇条書きは Step 5a で保持した「対応した」スレッドの修正内容から生成する。
- resolve は対象スレッドごとに 1 回ずつ実行する（push back のものは resolve しない）。

### Step 9: サマリ出力

提示（Step 7）と完了報告（Step 8 後）のいずれも以下の形式で報告する。

```
## review-pr-comments サマリ (PR #1234)

### Copilot
- 自動修正: N 件
- resolve のみ（対応不要判断）: N 件
- push back（要追加判断）: N 件
- typecheck: PASS / FAIL
- lint: PASS / FAIL
- コミット: 未実施（承認待ち） / <commit hash>・push 済み・resolve 済み

### 人間
- 対応提案: N 件（下記）
  - <file>:<line> by <author>: <提案概要>
- 対応不要と判断: N 件
```

## 重要な制約

- **commit / push / resolve はユーザーの明示指示後にのみ実行する**。自動修正・検証まで終えたら報告して停止する（CLAUDE.md「コミットはユーザーの明示的な指示があるまで実行しない／都度確認もしない」に従う）。Copilot モードでも自動でコミットしない。
- **resolve は Copilot スレッドのみ**。人間スレッドは絶対に resolve しない。
- **コミット粒度は Copilot 全件で 1 コミット**。コメント毎に分割しない。
- **typecheck / lint 失敗時は commit/push/resolve を一切行わない**。エラー内容をそのままユーザーに報告して停止する。
- **スレッド返信は行わない**。`addPullRequestReviewThreadReply` mutation や `gh api .../comments/{id}/replies` は使用しない。
- **push back（コメントに反論）と判定された場合**: コードは修正せず、resolve もせず、ユーザーへ「このコメントは反論が必要」と理由付きで報告する。

## 出力フォーマット例

人間コメントの提案部分の例：

```
### レビュワーからのコメント (3 件)

#### facility/src/foo.ts:42 — @reviewer-name
> （コメント本文の引用）

**対応方針案:** `Foo` クラスの `bar()` メソッドで null ガードを追加する。具体的には L40-45 を以下のように変更する。

(変更案のコード片)

判断: 対応推奨 / 任意 / 反論検討
```
