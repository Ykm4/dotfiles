#!/bin/bash
# PreToolUse hook: 配備先のプロファイル構成（chezmoi の配布物）への Edit/Write を拒否し、正本へ誘導する。
# 対象は ~/.config/claude/<プロファイル> の構成項目（CLAUDE.md・settings.json・keybindings.json・rules・commands）。
# _shared と _private は正本そのものなので対象外。
# Bash 経由の書き込みまでは止められない。最後の砦は chezmoi diff の検査。
set -euo pipefail

INPUT=$(cat || true)
[ -z "$INPUT" ] && exit 0

FILE_PATH=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<< "$INPUT")
[ -z "$FILE_PATH" ] && exit 0

REASON='このファイルは dotfiles が配る配布物なので直接編集しない。settings.json は基底 ~/other/dotfiles/home/.chezmoitemplates/claude/settings.json.tmpl（取引先の差分は client-dotfiles の <取引先>/.chezmoitemplates/）、CLAUDE.md は home/private_dot_claude/（既定）か home/dot_config/claude/private_<プロファイル>/、共通の rules・keybindings・scripts は home/dot_config/claude/_shared/ を編集し、chezmoi apply で配備する。'

deny() {
  jq -n --arg reason "$REASON" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

case "$FILE_PATH" in
  "$HOME/.config/claude/_shared/"* | "$HOME/.config/claude/_private/"*) exit 0 ;;
esac

for root in "$HOME/.claude" "$HOME"/.config/claude/*; do
  [ -d "$root" ] || continue
  case "$FILE_PATH" in
    "$root/CLAUDE.md" | "$root/settings.json" | "$root/keybindings.json") deny ;;
    "$root/rules/"* | "$root/commands/"*) deny ;;
  esac
done

exit 0
