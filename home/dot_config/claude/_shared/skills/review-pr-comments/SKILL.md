---
name: review-pr-comments
description: PR の未解決レビューコメントを取得して処理するスキル。Copilot からの inline コメントは判断→自動修正→検証まで行い、commit / push / resolve / hide はユーザーの明示指示後に実行する。Copilot が投稿せず review 本文へ畳んだ suppressed comments も対象にし、thread が無く resolve できないため hide（minimizeComment）で畳む。人間からの inline コメントは対応方針を提示するのみで自動修正は行わない。`/review-pr-comments [PR番号]` で起動し、引数省略時は current branch から PR を自動特定する。「PRレビュー対応」「Copilot コメント対応」「レビューコメント確認」「未解決コメント」「PR コメント」「suppressed comments」と言われたとき、または PR レビュー対応を始めるときに使用する。
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
  # スキル本体は _shared 配下が実体で、各プロファイルと ~/.claude から symlink される。
  # 呼び出し時の literal path はどれになるか決まらないため 3 形態すべてを許可する。
  - Bash(/Users/ykm4/.claude/skills/review-pr-comments/scripts/*)
  - Bash(/Users/ykm4/.config/claude/_shared/skills/review-pr-comments/scripts/*)
  - Bash(/Users/ykm4/.config/claude/hucom-system/skills/review-pr-comments/scripts/*)
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Skill
---

# Review PR Comments

## 概要

GitHub PRの未解決inline reviewコメントと、Copilotがreview本文へ畳んだsuppressed commentsを処理する。Copilotからの指摘は判断→自動修正→検証まで行い、commit/push/resolve/hideはユーザーの明示指示後に実行する（自動ではコミットしない）。人間からのコメントは対応方針の提示のみ（自動修正・commit/push/resolve/hideは行わない）。

## 重要な前提

- **対応判断ロジック**は`superpowers:receiving-code-review`スキルに従う。各コメントを評価する前にSkillツールでこのスキルを必ず読み込む。
- **対象は inline review comment と suppressed comments**。PR全体への一般コメント（issue comment）は対象外。
- **suppressed comments とは**: Copilotが生成したがinlineコメントとして投稿しないと判断した指摘。review本文の`<details><summary>Suppressed comments (N)</summary>`に畳まれる。
  - review threadが作られないため`resolveReviewThread`は使えない。`minimizeComment`（GitHub UIのHide comment）でreview本文ごと畳む。
  - 「投稿されなかった」だけで内容が的外れとは限らない。修正すべき誤りが含まれていることがあるため必ず読む。
  - review本文のmarkdownを直接解析しないと取得できない。`gh pr view --json reviews`や`reviewThreads`の取得では得られない。
- **未解決スレッドのみ**を処理する（`isResolved == true`のスレッドは無視）。
- **hide 済みの review は無視する**（`isMinimized == true`）。
- **outdated スレッドの扱い**: 既に該当箇所が変更されたスレッドも、未解決なら対象に含める。判断ロジックで「対応不要」となればコード修正はせずresolve対象として扱う（実際のresolveはStep 8でユーザー指示後に実行する）。
- **スレッド返信は不要**。コメント内容に対する文章での返信は行わない。
- **gh コマンドのオプション差分**: 本スキルが利用する`gh api graphql`/`gh pr view`/`gh repo view`は枯れたAPIなのでハードコーディング前提。万一`unrecognized flag`等のエラーが出たら、該当サブコマンドを`gh <subcommand> --help`で確認して現行オプションに合わせて再実行する。

## ワークフロー

### Step 1: 引数を解析して対象を特定する

引数の形式によって処理対象を切り替える。

| 引数 | owner / name / PR | 対象 |
|------|-------------------|------|
| (省略) | current branch から`gh pr view`で自動特定 | 全未解決スレッド + 全 suppressed comments |
| `<PR番号>` | current repo (`gh repo view`) + 指定番号 | 全未解決スレッド + 全 suppressed comments |
| `https://github.com/<owner>/<name>/pull/<N>` | URL から抽出 | 全未解決スレッド + 全 suppressed comments |
| `https://github.com/<owner>/<name>/pull/<N>#discussion_r<comment_id>` | URL から抽出 | 該当コメントを含む 1 スレッドのみ |
| `https://github.com/<owner>/<name>/pull/<N>#pullrequestreview-<review_id>` | URL から抽出 | 全未解決スレッド + 全 suppressed comments（review では絞らない） |

`#discussion_r<id>`以外のfragment（`#pullrequestreview-<id>`・`#issuecomment-<id>`など）はスレッドを特定しない。これらが渡されたときはPR番号だけを取り出し、対象はPR全体として扱う。複数のURLが渡された場合、同じPRを指しているなら1回の処理にまとめる。`#discussion_r<id>`が2件以上渡された場合は、`TARGET_COMMENT_DB_ID`が1件しか保持できないため、そのPRの全未解決スレッドを対象にする。

URLは次のように解析する。

```bash
TARGET_COMMENT_DB_ID=""  # 空ならスレッド全件対象

# fragment は種類を問わず受ける。#pullrequestreview-<id> や #issuecomment-<id> で
# 起動されることがあり、ここで弾くと current branch へ誤ってフォールバックする。
if [[ "$ARG" =~ ^https://github\.com/([^/]+)/([^/]+)/pull/([0-9]+)(#[^[:space:]]*)?$ ]]; then
  OWNER="${BASH_REMATCH[1]}"
  NAME="${BASH_REMATCH[2]}"
  PR_NUMBER="${BASH_REMATCH[3]}"
  FRAGMENT="${BASH_REMATCH[4]}"
  # スレッドを絞るのは #discussion_r<id> のときだけ。他の fragment は PR 単位で扱う
  if [[ "$FRAGMENT" =~ ^#discussion_r([0-9]+)$ ]]; then
    TARGET_COMMENT_DB_ID="${BASH_REMATCH[1]}"
  fi
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

**cwd 依存の制約**: URL渡し以外（PR番号指定または引数省略）の場合、`gh repo view`と`gh pr view`はcwdに依存する。current branchのリポジトリと対象PRのリポジトリが異なる場合はURL渡しを必須とする。

`TARGET_COMMENT_DB_ID`がセットされている場合は、Step 2取得後に該当スレッドのみ抽出する。

```bash
THREADS="$(echo "$THREADS" | jq --argjson tid "$TARGET_COMMENT_DB_ID" \
  '[.[] | select(.comments.nodes[] | .databaseId == $tid)]')"
```

### Step 2: 未処理の指摘を取得

inline threadとsuppressed commentsの2系統を取得する。片方が0件でももう片方に指摘が残っていることがあるので、`TARGET_COMMENT_DB_ID`で対象を絞る場合を除き、必ず両方を実行する。

**inline thread**

```bash
THREADS="$(${CLAUDE_SKILL_DIR}/scripts/fetch-unresolved-threads.sh "$OWNER" "$NAME" "$PR_NUMBER")"
```

返り値は`[{ kind, id, isResolved, isOutdated, path, comments: { totalCount, nodes: [...] } }]`のJSON配列。`kind`は`"thread"`で、suppressed comments側の`"suppressed"`と取り違えないための目印。各スレッドの`id`（GraphQL node ID）は後のresolveで使う。取得上限（thread 100件・threadあたりコメント20件）を超えた分がある場合はWARNINGがstderrに出るので、未取得分は手動で確認する。

**suppressed comments**

```bash
SUPPRESSED="$(${CLAUDE_SKILL_DIR}/scripts/fetch-suppressed-comments.sh "$OWNER" "$NAME" "$PR_NUMBER")"
```

返り値は`[{ kind, id, databaseId, author, url, submittedAt, inlineCommentCount, suppressedCount, paths, block }]`のJSON配列。`kind`は`"suppressed"`。

- `id`はreviewのGraphQL node IDで、後のhideに使う（thread IDではない）。
- `block`は`<details>`の中身そのまま。指摘の本文はここを読む。1 reviewに複数件入る。
- `paths`は`**path:line**`見出しから抜いた対象一覧。件数の突き合わせに使う。
- `inlineCommentCount`が0より大きいreviewはinline threadも持つ。resolveとhideを別々に扱う。
- 既にhide済み（`isMinimized == true`）のreviewは除外される。
- 取得上限はreview 100件。上限の超過に加え、次の2つでもWARNINGがstderrに出る。どちらもCopilot側の出力形式が変わった可能性を示すので、`url`から本文を直接読む。
  - summaryにsuppressとあるのに`<details>`の構造を解析できなかった
  - 宣言された件数と、抽出できた見出しの数が食い違う

`TARGET_COMMENT_DB_ID`（`#discussion_r...`指定）がある場合は、特定のthreadを指しているのでsuppressed commentsは対象にしない。

### Step 3: 仕分け

各スレッドの**最初のコメントの投稿者**で判定する。

- `author.login`が`Copilot`、`copilot-pull-request-reviewer`、または`copilot`を含む`[bot]`系ユーザー → **Copilot モード**
- それ以外（人間レビュアー、その他のbot）→ **人間モード**

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

suppressed commentsはCopilot固有の機能なので原則Copilotモードで扱う。ただし`author`を確認し、大文字小文字を区別せずに`copilot`を含まなければ人間モードとして扱う（人間のreview本文はhideしない）。

### Step 4: `superpowers:receiving-code-review`を読み込む

判断フェーズの前に、Skillツールで以下を読み込む。

```
Skill: superpowers:receiving-code-review
```

このスキルが提供する評価フレームワーク（VERIFY → EVALUATE → RESPOND → IMPLEMENT、YAGNIチェック、push backの判断基準）を全コメントの判断に適用する。

### Step 5a: Copilot モード（判断→修正）

各Copilotスレッドを次のとおり処理する。

1. コメント本文・対象ファイル/行・diff hunkを読み、`receiving-code-review`のロジックで「対応する/対応しない」を判定する。
2. 判定結果を一覧として保持する（後でサマリ出力 & resolveに使う）。
3. 「対応する」と判定したものは、Edit/Writeツールで実際にコードを修正する。
4. 全Copilotスレッドの判定・修正が完了したら次のStepへ進む（コメントごとにcommit/pushしない）。

suppressed commentsも同じ判断ロジックにかける。加えて次の点に注意する。

- `block`に入っている指摘を1件ずつ評価する。`suppressedCount`と評価した件数が合っているか確認する。
- 対象ファイルがPRの差分から外れている場合（force-pushでファイルを削除した、別PRへ移した等）は、コード修正はせず「対応不要」と判定してよい。
- ただし同じ誤りが差分内の別の箇所にも当てはまらないかは確認する。ファイルが消えただけで指摘自体は正しいことがある。
- 判定はreview単位ではなく指摘単位で持つ。hideの可否は、そのreviewの全指摘が「対応した」か「対応不要」になったかで決まる。

**このスキルは commit / push / resolve / hide を自動実行しない（Step 7・Step 8 参照）。修正はワーキングツリーへの適用までで止める**。

### Step 5b: 人間モード（提案のみ）

各人間スレッドを次のとおり処理する。

1. コメント本文・対象ファイル/行・diff hunkを読み、`receiving-code-review`のロジックで判断する。
2. 「対応が必要」と判定したものは、**最適な修正方針**（変更すべきファイル・行・修正内容の要約）をユーザーへ提示する。
3. 自動でコードを修正しない。コミット・push・resolveも行わない。

ユーザーが個別に「この提案を適用して」と指示するまで待機する。

### Step 6: 検証（Copilot 自動修正がある場合のみ）

Copilot自動修正がある場合は、提示前に以下を実行する。

```bash
mise run typecheck
mise run lint
```

- いずれかが**失敗したら commit / push / resolve / hide を実行せず**、ユーザーへ失敗内容を報告して停止する。
- 成功したらStep 7（提示して停止）へ進む。

プロジェクトに`mise`タスクが存在しない場合は、`package.json`等からtypecheck/lintコマンドを特定して同等のコマンドを実行する。

### Step 7: 修正内容を提示して停止する（commit は自動で行わない）

プロジェクトの運用ルール（`CLAUDE.md`「コミットはユーザーの明示的な指示があるまで実行しない」）に従い、本スキルはcommit/push/resolve/hideを**自動実行しない**。

Copilot自動修正がある場合は、ここで次を提示して**停止する**。

- 適用した修正の一覧（1コメント = 1行、対象`file:line`と修正概要）
- suppressed commentsの判定一覧（review単位で、hide可否とその理由）
- typecheck/lintの結果（PASS/FAIL）
- commit/push/resolve/hideはユーザーの指示後に実行する旨

提示フォーマットはStep 9のサマリに準じる（この時点では「コミット: 未実施（承認待ち）」と記す）。

**ユーザーが commit を指示するまで Step 8 に進まない**。「コミットしてよいですか」と問い返さず、報告にとどめる（`CLAUDE.md`「都度確認もしない」に従う）。

### Step 8: コミット & push & resolve / hide（ユーザーが指示した後のみ）

コード修正を伴う場合は、ユーザーからcommitの明示指示があったら以下をまとめて実行する。

コード修正が1件も無くresolve/hideだけの場合は、コミットするものが無いので、ユーザーがresolve/hideを指示した時点で実行してよい（commit指示を待たない）。

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
for tid in $THREAD_IDS; do
  ${CLAUDE_SKILL_DIR}/scripts/resolve-thread.sh "$tid"
done

# 3. hide（suppressed comments を持つ Copilot review のうち、
#    全指摘が「対応した」か「対応不要」になったものだけ）
for rid in $REVIEW_NODE_IDS; do
  ${CLAUDE_SKILL_DIR}/scripts/hide-review.sh "$rid"
done
```

- 箇条書きはStep 5aで保持した「対応した」スレッドの修正内容から生成する。
- resolveとhideは1件ずつのコマンドだが、**ループで1回のBash呼び出しにまとめる**。1件ごとにツールを呼び分けると往復が件数分積み上がる。
- `hide-review.sh`は`<review_node_id>`の次の引数で`classifier`を指定でき、既定は`RESOLVED`。指定できる値はGitHub UIのプルダウンと同じ`SPAM`・`ABUSE`・`OFF_TOPIC`・`OUTDATED`・`DUPLICATE`・`RESOLVED`・`LOW_QUALITY`。
- `hide-review.sh`は実行前にnodeの型とauthorを確認し、`PullRequestReview`でない場合とauthorがCopilotでない場合はexit 65で拒否する。
- 取り消しは`${CLAUDE_SKILL_DIR}/scripts/hide-review.sh --undo "$REVIEW_NODE_ID"`。hideしたあとに判断が変わったらこれで戻す。

### Step 9: サマリ出力

提示（Step 7）と完了報告（Step 8後）のいずれも以下の形式で報告する。

```
## review-pr-comments サマリ (PR #1234)

### Copilot（inline thread）
- 自動修正: N 件
- resolve のみ（対応不要判断）: N 件
- push back（要追加判断）: N 件

### Copilot（suppressed comments）
- 対象 review: N 件（指摘 N 件）
- 自動修正: N 件
- 対応不要判断: N 件
- push back（要追加判断）: N 件
- hide: N review — 未実施（承認待ち） / 実施済み

### 共通
- typecheck: PASS / FAIL
- lint: PASS / FAIL
- コミット: 未実施（承認待ち） / <commit hash>・push 済み・resolve 済み

### 人間
- 対応提案: N 件（下記）
  - <file>:<line> by <author>: <提案概要>
- 対応不要と判断: N 件
```

該当が0件の節は「なし」と明記する。inline threadが0件でもsuppressed commentsに指摘が残っていることがあるため、inline threadだけを見て「指摘なし」と報告しない。

## 重要な制約

- **commit / push / resolve / hide はユーザーの明示指示後にのみ実行する**。自動修正・検証まで終えたら報告して停止する（`CLAUDE.md`「コミットはユーザーの明示的な指示があるまで実行しない／都度確認もしない」に従う）。Copilotモードでも自動でコミットしない。
- **resolve は Copilot スレッドのみ**。人間スレッドは絶対にresolveしない。
- **hide は Copilot の review のみ**。人間のreview本文は絶対にhideしない。
- **`hide-review.sh`の`--force`は使わない**。authorがCopilotでないとき、スクリプトは拒否してエラーメッセージで`--force`を案内する。この案内には従わず、ユーザーへ報告して停止する。
- **hide は review 単位で効く**。1つのreviewに複数のsuppressed commentsがあるとき、未対応やpush backが1件でも残るならhideしない（未対応分まで畳まれるため）。
- **suppressed comments に resolve を試みない**。threadが存在せず`resolveReviewThread`に渡すIDが無いので必ず失敗する。
- **コミット粒度は Copilot 全件で 1 コミット**。コメントごとに分割しない。
- **typecheck / lint 失敗時は commit / push / resolve / hide を一切行わない**。エラー内容をそのままユーザーに報告して停止する。
- **スレッド返信は行わない**。`addPullRequestReviewThreadReply` mutationや`gh api .../comments/{id}/replies`は使用しない。
- **push back（コメントに反論）と判定された場合**: コードは修正しない。resolveとhideも行わない。ユーザーへ「このコメントは反論が必要」と理由付きで報告する。

## 出力フォーマット例

人間コメントの提案部分の例を示す。

```
### レビュアーからのコメント (3 件)

#### facility/src/foo.ts:42 — @reviewer-name
> （コメント本文の引用）

**対応方針案:** `Foo` クラスの `bar()` メソッドで null ガードを追加する。具体的には L40-45 を以下のように変更する。

(変更案のコード片)

判断: 対応推奨 / 任意 / 反論検討
```
