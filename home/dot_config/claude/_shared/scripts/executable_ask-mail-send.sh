#!/bin/bash
# PreToolUse hook: gws のメッセージ送信（Gmail の +send・+reply・+reply-all・+forward、生 API の messages send・drafts send、Chat の +send）に確認を求める。
# ask ルールは先頭一致なので `gws --format json gmail +send` のような書き方をすり抜ける。コマンド全文を見て拾う。
# 下書き（--draft）と試し実行（--dry-run）は送信しないので対象外にする。
set -euo pipefail

INPUT=$(cat || true)
[ -z "$INPUT" ] && exit 0

CMD=$(jq -r '.tool_input.command // empty' <<< "$INPUT")
grep -qw 'gws' <<< "$CMD" || exit 0

ask() {
  jq -n --arg reason "$1" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: $reason}}'
  exit 0
}

# 生 API の送信は下書きの指定がないので、常に確認する。
if grep -Eq '(messages|drafts)[[:space:]]+send([[:space:]]|$)' <<< "$CMD"; then
  ask 'Gmail の生 API で送信するコマンド。送信はユーザーの承認が要る。'
fi

sends=$( (grep -Eo '\+(send|reply|reply-all|forward)([[:space:]]|$)' <<< "$CMD" || true) | wc -l | tr -d ' ')
[ "$sends" -eq 0 ] && exit 0

# ponytail: 送信コマンドの数と --draft・--dry-run の数を比べるだけ。本文に「 --draft 」と書くとすり抜けるが、その書き方は想定しない。
flags=$( (grep -Eo '(^|[[:space:]])--(draft|dry-run)([[:space:]]|$)' <<< "$CMD" || true) | wc -l | tr -d ' ')
[ "$flags" -ge "$sends" ] && exit 0

ask 'メッセージを送信するコマンド。送信はユーザーの承認が要る（下書きなら --draft を付ける）。'
