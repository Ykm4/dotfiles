#!/usr/bin/env bash
# Review thread を resolve する。
#
# Usage: resolve-thread.sh <thread_node_id>
# Output: { thread: { id, isResolved } }
#
# thread_node_id は fetch-unresolved-threads.sh が返す .id（GraphQL node ID）。
# 失敗時は gh の stderr をそのまま伝搬する。

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <thread_node_id>" >&2
  exit 64
fi

THREAD_ID="$1"

gh api graphql \
  -F threadId="$THREAD_ID" \
  -f query='
mutation($threadId:ID!) {
  resolveReviewThread(input:{threadId:$threadId}) {
    thread { id isResolved }
  }
}' \
  | jq '.data.resolveReviewThread'
