#!/usr/bin/env bash
# 未解決の inline review thread を取得して JSON 配列で返す。
#
# Usage: fetch-unresolved-threads.sh <owner> <name> <pr_number>
# Output: jq array of { id, isOutdated, path, comments: [...] }
#
# 100 件超の review thread を持つ PR ではページネーション拡張が必要。
# 失敗時は gh / jq の stderr をそのまま伝搬する。

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <owner> <name> <pr_number>" >&2
  exit 64
fi

OWNER="$1"
NAME="$2"
PR_NUMBER="$3"

gh api graphql \
  -F owner="$OWNER" \
  -F name="$NAME" \
  -F number="$PR_NUMBER" \
  -f query='
query($owner:String!, $name:String!, $number:Int!) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$number) {
      reviewThreads(first:100) {
        nodes {
          id
          isResolved
          isOutdated
          path
          comments(first:20) {
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
}' \
  | jq '.data.repository.pullRequest.reviewThreads.nodes
        | map(select(.isResolved == false))'
