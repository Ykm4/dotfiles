#!/bin/bash
set -euo pipefail

INPUT=$(cat || true)
[ -z "$INPUT" ] && exit 0

EVENT_TYPE=$(jq -r '.hook_event_name // "Stop"' <<< "$INPUT")
STOP_HOOK_ACTIVE=$(jq -r '.stop_hook_active // "false"' <<< "$INPUT")
PROJECT_NAME=$(basename "$PWD")

# 無限ループ防止（全イベント共通）
[ "$STOP_HOOK_ACTIVE" = "true" ] && exit 0

# イベントに応じたメッセージ
case "$EVENT_TYPE" in
  Stop)          BODY="処理が完了しました" ;;
  Notification)  BODY="応答を待っています" ;;
  *)             BODY="イベント: $EVENT_TYPE" ;;
esac

# cmux 起動中なら cmux notify、そうでなければ terminal-notifier
if [ -S /tmp/cmux.sock ]; then
  cmux notify --title "Claude Code · $PROJECT_NAME" --body "$BODY"
elif command -v terminal-notifier &>/dev/null; then
  terminal-notifier \
    -title "Claude Code 🤖" \
    -subtitle "プロジェクト: $PROJECT_NAME" \
    -message "$BODY" \
    -sound "Blow" \
    -group "claude-code-completion"
fi
