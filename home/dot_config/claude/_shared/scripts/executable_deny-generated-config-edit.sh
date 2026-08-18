#!/bin/bash
# PreToolUse hook: 配備先のプロファイル構成（生成物）への Edit/Write を拒否し、正本へ誘導する。
# 対象は実プロファイル（~/.claude と ~/.config/claude/<プロファイル>）の構成項目
# （CLAUDE.md・settings.json・keybindings.json・rules・commands）と、
# 中間層 ~/.config/claude-profile-config/ 配下のすべて。
# _shared と _private は正本そのものなので対象外。
# Bash 経由の書き込みまでは止められない。最後の砦は install-profiles -- --check の検査。
set -euo pipefail

INPUT=$(cat || true)
[ -z "$INPUT" ] && exit 0

FILE_PATH=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<< "$INPUT")
[ -z "$FILE_PATH" ] && exit 0

REASON='このファイルは dotfiles からの生成物なので直接編集しない。正本 ~/other/dotfiles/home/dot_config/claude-profile-config/<プロファイル>/ を編集し、chezmoi apply と mise r claude:install-profiles で配備する。共通の rules・keybindings・scripts の正本は home/dot_config/claude/_shared/ にある。'

deny() {
  jq -n --arg reason "$REASON" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

case "$FILE_PATH" in
  "$HOME/.config/claude-profile-config/"*) deny ;;
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
