#!/usr/bin/env bash
# Copilot レビュー本文に畳まれた suppressed comments を取得して JSON 配列で返す。
#
# Usage: fetch-suppressed-comments.sh <owner> <name> <pr_number>
# Output: jq array of
#   { kind, id, databaseId, author, url, submittedAt,
#     inlineCommentCount, suppressedCount, paths, block }
#
# suppressed comments は Copilot が生成したが inline コメントとして投稿しないと
# 判断した指摘で、review 本文の
#   <details><summary>Suppressed comments (N)</summary> ... </details>
# に記録される。review thread が作られないため resolveReviewThread は使えない。
# 畳むには hide-review.sh（minimizeComment）を使う。
#
# id は review の node ID。fetch-unresolved-threads.sh が返す thread node ID とは
# 別物なので、取り違えを防ぐため kind を付けて返す。
#
# 既に hide 済み（isMinimized == true）の review は除外する。
# reviews は last:100 が取得上限。超えた分がある場合は WARNING を stderr に出す。
#
# 本文の markdown を正規表現で解析する脆い処理なので、Copilot 側の出力形式が
# 変わったことに気付けるよう、次の 2 つも WARNING で知らせる。
#   - summary に suppress とあるのに <details> の構造を解析できなかった
#   - 宣言された件数と、抽出できた見出しの数が食い違う
# 失敗時は gh / jq の stderr をそのまま伝搬する。

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <owner> <name> <pr_number>" >&2
  exit 64
fi

OWNER="$1"
NAME="$2"
PR_NUMBER="$3"

# <details> ブロックの抽出パターン。jq の "m" フラグで '.' が改行にマッチする。
# --arg で渡すため jq の文字列リテラル処理は入らない。バックスラッシュは 1 つで書く。
BLOCK_RE='<summary>[^<]*Suppressed comments \(([0-9]+)\)</summary>(.*?)</details>'

resp="$(gh api graphql \
  -F owner="$OWNER" \
  -F name="$NAME" \
  -F number="$PR_NUMBER" \
  -f query='
query($owner:String!, $name:String!, $number:Int!) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$number) {
      reviews(last:100) {
        totalCount
        nodes {
          id
          databaseId
          url
          submittedAt
          isMinimized
          body
          author { login }
          comments { totalCount }
        }
      }
    }
  }
}')"

# 取得上限の超過を警告する（stdout は汚さない）
jq -r '
  .data.repository.pullRequest.reviews
  | select(.totalCount > (.nodes | length))
  | "WARNING: review が \(.totalCount) 件中 \(.nodes | length) 件のみ取得（last:100 上限）。残りは手動確認が必要"
' <<<"$resp" >&2

# 形式変更の検知。BLOCK_RE そのものではなく緩いラベル一致で見る。
# BLOCK_RE で判定すると、ラベルごと変わったときに検知側も同時に外れて無音になる。
jq -r --arg re "$BLOCK_RE" '
  .data.repository.pullRequest.reviews.nodes[]
  | select(.isMinimized == false)
  | (.body // "") as $body
  | select(($body | test("<summary>[^<]*suppress"; "i")) and ($body | test($re; "m") | not))
  | "WARNING: review \(.databaseId) の本文に suppressed comments らしき記述があるが構造を解析できなかった。本文を直接読む: \(.url)"
' <<<"$resp" >&2

parsed="$(jq --arg re "$BLOCK_RE" '
  .data.repository.pullRequest.reviews.nodes
  | map(
      select(.isMinimized == false)
      | [ (.body // "") | match($re; "gm") ] as $matches
      | select($matches | length > 0)
      | ([ $matches[].captures[1].string ] | join("\n")) as $block
      | {
          kind: "suppressed",
          id,
          databaseId,
          author: .author.login,
          url,
          submittedAt,
          inlineCommentCount: .comments.totalCount,
          suppressedCount: ([ $matches[].captures[0].string | tonumber ] | add),
          paths: ([ $block | scan("\\*\\*([^*\\n]+?:[0-9]+)\\*\\*") ] | flatten),
          block: $block
        }
    )
' <<<"$resp")"

# 宣言された件数と、抽出できた見出しの数の食い違いを警告する。
# 見出しの書式だけが変わると paths が欠けるが、JSON の形は正しいままなので気付けない。
jq -r '
  .[]
  | select((.paths | length) != .suppressedCount)
  | "WARNING: review \(.databaseId) は \(.suppressedCount) 件と宣言しているが見出しは \(.paths | length) 件しか抽出できなかった。本文を直接読む: \(.url)"
' <<<"$parsed" >&2

# review 本文は CRLF を含むため JSON に \r エスケープが乗る。
# echo だとシェルによっては展開されてしまうので printf で素通しする。
printf '%s\n' "$parsed"
