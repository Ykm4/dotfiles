#!/usr/bin/env bash
# Copilot が投稿した review 本文のうち、まだ hide されていないものを JSON 配列で返す。
#
# Usage: fetch-copilot-reviews.sh <owner> <name> <pr_number>
# Output: jq array of
#   { kind, id, databaseId, author, url, submittedAt, state,
#     inlineCommentCount, unresolvedThreadCount, hasSuppressed }
#
# Copilot の review は「Copilot review overview」の本文と、inline コメント（thread）で
# 構成される。thread を resolve しても review 本文は PR の会話欄に残るため、
# 全 thread を処理し終えた review は hide-review.sh（minimizeComment, RESOLVED）で畳む。
# この script は、その判断に必要な「review ごとの未解決 thread 数」を返す。
#
# unresolvedThreadCount は、review の inline コメントを先頭コメントに持つ thread のうち
# isResolved == false のものの数。0 なら resolve 側は完了している。
# hasSuppressed は本文に suppressed comments の <details> があるかどうか。
# true の review は fetch-suppressed-comments.sh 側の判定も済んでから hide する。
#
# id は review の node ID（PRR_...）。fetch-unresolved-threads.sh の thread node ID
# （PRRT_...）とは別物なので、取り違えを防ぐため kind を付けて返す。
#
# 既に hide 済み（isMinimized == true）の review と、author が Copilot でない review は
# 除外する。reviews / reviewThreads は 100 件が取得上限で、超えた分がある場合は
# WARNING を stderr に出す。失敗時は gh / jq の stderr をそのまま伝搬する。

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <owner> <name> <pr_number>" >&2
  exit 64
fi

OWNER="$1"
NAME="$2"
PR_NUMBER="$3"

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
          state
          isMinimized
          body
          author { login }
          comments(first:100) {
            totalCount
            nodes { databaseId }
          }
        }
      }
      reviewThreads(first:100) {
        totalCount
        nodes {
          isResolved
          comments(first:1) {
            nodes { databaseId }
          }
        }
      }
    }
  }
}')"

# 取得上限の超過を警告する（stdout は汚さない）
jq -r '
  .data.repository.pullRequest
  | (.reviews | select(.totalCount > (.nodes | length))
      | "WARNING: review が \(.totalCount) 件中 \(.nodes | length) 件のみ取得（last:100 上限）。残りは手動確認が必要"),
    (.reviewThreads | select(.totalCount > (.nodes | length))
      | "WARNING: thread が \(.totalCount) 件中 \(.nodes | length) 件のみ取得（first:100 上限）。unresolvedThreadCount が過小になりうる"),
    (.reviews.nodes[] | select(.comments.totalCount > (.comments.nodes | length))
      | "WARNING: review \(.databaseId) の inline コメントが \(.comments.totalCount) 件中 \(.comments.nodes | length) 件のみ取得（first:100 上限）")
' <<<"$resp" >&2

jq '
  .data.repository.pullRequest as $pr
  | [ $pr.reviewThreads.nodes[]
      | select(.isResolved == false)
      | .comments.nodes[0].databaseId
    ] as $unresolvedFirstIds
  | $pr.reviews.nodes
  | map(
      select(.isMinimized == false)
      | select(.author.login | test("copilot"; "i"))
      | [ .comments.nodes[].databaseId ] as $commentIds
      | {
          kind: "review",
          id,
          databaseId,
          author: .author.login,
          url,
          submittedAt,
          state,
          inlineCommentCount: .comments.totalCount,
          unresolvedThreadCount: ([ $unresolvedFirstIds[] | select(. as $id | $commentIds | index($id) != null) ] | length),
          hasSuppressed: ((.body // "") | test("<summary>[^<]*suppress"; "i"))
        }
    )
' <<<"$resp"
