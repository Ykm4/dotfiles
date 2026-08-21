#!/usr/bin/env bash
# Review 本文を hide（minimize）する。GitHub UI の「Hide comment」と同じ操作。
#
# Usage: hide-review.sh [--force] <review_node_id> [classifier]
#        hide-review.sh --undo <review_node_id>
# Output: hide 時   { id, isMinimized, minimizedReason }
#         --undo 時 { id, isMinimized }
#
# review thread を持たない suppressed comments を畳むために使う。
# review_node_id は fetch-suppressed-comments.sh が返す .id（review の node ID）。
# thread の node ID を渡さないよう、実行前に node の型と author を確認する。
#
# 人間のレビュー本文を畳むと他の全員から見えなくなるため、author が Copilot で
# ない場合は拒否する。意図して畳むときだけ --force を付ける。
# classifier の既定は RESOLVED。指定できる値は下の CLASSIFIERS を参照する。
#
# hide は review 単位で効く。1 つの review に複数の suppressed comments がある場合、
# 一部だけ対応した状態で hide すると未対応分まで畳まれるので注意する。
# --undo（unminimizeComment）でいつでも戻せる。--undo に検証は掛けない。
# 失敗時は gh の stderr をそのまま伝搬する。

set -euo pipefail

# GitHub の ReportedContentClassifiers。GitHub UI のプルダウンと同じ選択肢。
CLASSIFIERS=(SPAM ABUSE OFF_TOPIC OUTDATED DUPLICATE RESOLVED LOW_QUALITY)

usage() {
  echo "Usage: $0 [--force] <review_node_id> [classifier]" >&2
  echo "       $0 --undo <review_node_id>" >&2
  echo "classifier: ${CLASSIFIERS[*]}（既定 RESOLVED）" >&2
  exit 64
}

[[ $# -ge 1 ]] || usage

if [[ "$1" == "--undo" ]]; then
  [[ $# -eq 2 ]] || usage
  gh api graphql \
    -F subjectId="$2" \
    -f query='
mutation($subjectId:ID!) {
  unminimizeComment(input:{subjectId:$subjectId}) {
    unminimizedComment {
      isMinimized
      ... on PullRequestReview { id }
    }
  }
}' | jq '.data.unminimizeComment.unminimizedComment'
  exit 0
fi

FORCE=false
if [[ "$1" == "--force" ]]; then
  FORCE=true
  shift
fi

[[ $# -ge 1 && $# -le 2 ]] || usage

SUBJECT_ID="$1"
CLASSIFIER="${2:-RESOLVED}"

if [[ " ${CLASSIFIERS[*]} " != *" ${CLASSIFIER} "* ]]; then
  # 直後が全角括弧なので ${} で変数名を区切る。$CLASSIFIER） だと
  # bash が全角文字の先頭バイトまで変数名に取り込んで unbound variable になる。
  echo "Error: classifier が不正です（指定値: ${CLASSIFIER}）" >&2
  usage
fi

if [[ "$FORCE" == false ]]; then
  target="$(gh api graphql \
    -F id="$SUBJECT_ID" \
    -f query='
query($id:ID!) {
  node(id:$id) {
    __typename
    ... on PullRequestReview { author { login } }
  }
}' -q '[.data.node.__typename, (.data.node.author.login // "")] | @tsv')"
  IFS=$'\t' read -r TYPENAME LOGIN <<<"$target"

  if [[ "$TYPENAME" != "PullRequestReview" ]]; then
    echo "Error: node が PullRequestReview ではありません（${TYPENAME:-不明}）。review の node ID を渡してください（thread の ID ではありません）" >&2
    exit 65
  fi
  if [[ "$(printf '%s' "$LOGIN" | tr '[:upper:]' '[:lower:]')" != *copilot* ]]; then
    echo "Error: author が Copilot ではありません（${LOGIN:-不明}）。人間のレビュー本文は hide しません。意図して畳むなら --force を付けてください" >&2
    exit 65
  fi
fi

gh api graphql \
  -F subjectId="$SUBJECT_ID" \
  -F classifier="$CLASSIFIER" \
  -f query='
mutation($subjectId:ID!, $classifier:ReportedContentClassifiers!) {
  minimizeComment(input:{subjectId:$subjectId, classifier:$classifier}) {
    minimizedComment {
      isMinimized
      minimizedReason
      ... on PullRequestReview { id }
    }
  }
}' | jq '.data.minimizeComment.minimizedComment'
