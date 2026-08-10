#!/usr/bin/env bash
# 未解決の inline review thread を取得して JSON 配列で返す。
#
# Usage: fetch-unresolved-threads.sh <owner> <name> <pr_number>
# Output: jq array of { id, isOutdated, path, comments: {...} }
#
# reviewThreads は first:100・thread ごとの comments は first:20 が取得上限。
# 上限を超えた分がある場合は WARNING を stderr に出す（stdout の JSON 形式は変えない）。
# 失敗時は gh / jq の stderr をそのまま伝搬する。

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
      reviewThreads(first:100) {
        totalCount
        nodes {
          id
          isResolved
          isOutdated
          path
          comments(first:20) {
            totalCount
            nodes {
              id
              databaseId
              author { login }
              body
              path
              line
              originalLine
              diffHunk
              url
            }
          }
        }
      }
    }
  }
}')"

# 取得上限の超過を警告する（stdout は汚さない）
jq -r '
  .data.repository.pullRequest.reviewThreads
  | select(.totalCount > (.nodes | length))
  | "WARNING: review thread が \(.totalCount) 件中 \(.nodes | length) 件のみ取得（first:100 上限）。残りは手動確認が必要"
' <<<"$resp" >&2
jq -r '
  .data.repository.pullRequest.reviewThreads.nodes[]
  | select(.comments.totalCount > (.comments.nodes | length))
  | "WARNING: thread \(.id) のコメントが \(.comments.totalCount) 件中 \(.comments.nodes | length) 件のみ取得（first:20 上限）"
' <<<"$resp" >&2

jq '.data.repository.pullRequest.reviewThreads.nodes
    | map(select(.isResolved == false))' <<<"$resp"
