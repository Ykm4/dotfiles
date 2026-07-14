#!/bin/bash
# Ghostty テーマ管理スクリプト
set -euo pipefail

CONFIG="$HOME/.config/ghostty/config"
THEMES_DIR="/Applications/Ghostty.app/Contents/Resources/ghostty/themes"

usage() {
  echo "Usage: ghostty-theme <command> [args]"
  echo ""
  echo "Commands:"
  echo "  current              現在のテーマを表示"
  echo "  set <theme>          テーマを変更"
  echo "  list [pattern]       テーマ一覧（パターンでフィルタ可能）"
  echo "  search <keyword>     テーマをキーワード検索"
  exit 1
}

current_theme() {
  grep -E "^theme[[:space:]]*=" "$CONFIG" | sed 's/^theme[[:space:]]*=[[:space:]]*//' | head -1
}

set_theme() {
  local theme="$1"
  # テーマの存在確認
  if [ ! -f "$THEMES_DIR/$theme" ]; then
    echo "Error: テーマ '$theme' が見つかりません"
    echo ""
    echo "候補:"
    ls "$THEMES_DIR" | grep -i "${theme}" || echo "  (該当なし)"
    exit 1
  fi

  local current
  current=$(current_theme)

  if [ -n "$current" ]; then
    # 既存のアクティブなtheme行を置換
    sed -i '' "s/^theme = .*/theme = ${theme}/" "$CONFIG"
  else
    # コメントアウトされたtheme行の直後に追加、なければファイル先頭に追加
    if grep -q "^# theme = " "$CONFIG"; then
      sed -i '' "/^# theme = .*/a\\
theme = ${theme}
" "$CONFIG"
    else
      sed -i '' "1i\\
theme = ${theme}
" "$CONFIG"
    fi
  fi

  echo "Theme changed: ${current:-none} → ${theme}"
}

list_themes() {
  local pattern="${1:-}"
  if [ -n "$pattern" ]; then
    ls "$THEMES_DIR" | grep -i "$pattern"
  else
    ls "$THEMES_DIR"
  fi
}

# Main
[ $# -lt 1 ] && usage

case "$1" in
  current)
    theme=$(current_theme)
    echo "${theme:-未設定}"
    ;;
  set)
    [ $# -lt 2 ] && { echo "Error: テーマ名を指定してください"; exit 1; }
    shift
    set_theme "$*"
    ;;
  list)
    shift
    list_themes "${1:-}"
    ;;
  search)
    [ $# -lt 2 ] && { echo "Error: キーワードを指定してください"; exit 1; }
    shift
    list_themes "$*"
    ;;
  *)
    # 引数がコマンドでなければテーマ名として扱う
    set_theme "$*"
    ;;
esac
