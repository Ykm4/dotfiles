#!/bin/bash
# Ghostty 設定管理スクリプト（cmux / Ghostty.app 共用）
set -euo pipefail

CONFIG="${GHOSTTY_CONFIG:-$HOME/.config/ghostty/config}"

die() {
  echo "Error: $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: ghostty-config <command> [args]

Commands:
  get <key>            設定値を表示
  set <key> <value>    設定値を変更
  theme <name>         テーマを変更（存在確認と表記ゆれの正規化つき）
  list [pattern]       テーマ一覧（パターンでフィルタ可能）
  reload               設定を反映（cmux があれば cmux reload-config）

よく使うキー:
  theme, font-size, background-opacity, background-blur
  sidebar-font-size, surface-tab-bar-font-size, split-divider-color  # cmux 独自
EOF
  exit 1
}

# テーマディレクトリを解決する。cmux.app を優先し、無ければ Ghostty.app を使う。
# 両アプリの同梱テーマは同一なので、どちらを引いてもテーマ名は変わらない。
themes_dir() {
  local d
  for d in \
    "/Applications/cmux.app/Contents/Resources/ghostty/themes" \
    "/Applications/Ghostty.app/Contents/Resources/ghostty/themes"; do
    if [ -d "$d" ]; then
      echo "$d"
      return 0
    fi
  done
  die "テーマディレクトリが見つかりません（cmux.app・Ghostty.app のいずれも未検出）"
}

# 設定ファイルの読み書きは awk に統一する。grep のパイプラインは未設定キーで
# 終了コード 1 を返し、pipefail と set -e の組み合わせでスクリプトごと終了するため。
# Ghostty の設定は `=` の前後の空白を無視し、コメントは行頭のみ有効。
get_value() {
  awk -v k="$1" '
    $0 ~ "^[[:space:]]*"k"[[:space:]]*=" { sub(/^[^=]*=[[:space:]]*/, ""); print; exit }
  ' "$CONFIG"
}

count_key() {
  awk -v k="$1" '
    $0 ~ "^[[:space:]]*"k"[[:space:]]*=" { c++ }
    END { print c + 0 }
  ' "$CONFIG"
}

set_value() {
  local key="$1" value="$2" n before

  # Ghostty は小数のフォントサイズを受け付ける（高 DPI 向けの半ポイント指定）。
  case "$key" in
  font-size | *-font-size)
    [[ "$value" =~ ^[0-9]+(\.[0-9]+)?$ ]] ||
      die "'${key}' は数値で指定してください: '${value}'"
    ;;
  esac

  # font-family や keybind のように意図的に複数行を並べるキーがある。
  # どの行を書き換えるべきか機械的に決められないので、手動編集に委ねる。
  n=$(count_key "$key")
  [ "$n" -le 1 ] ||
    die "'${key}' の有効な行が ${n} 行あります。意図しない上書きを避けるため手動で編集してください: $CONFIG"

  before=$(get_value "$key")

  # 有効行があれば置換し、無ければコメントアウトされた同名キーの直後に、
  # それも無ければ末尾に足す。3 番目の規則を n で抑止するのは、コメント行が
  # 有効行より前にある設定で新旧の行が二重に残るのを防ぐため。
  awk -v k="$key" -v v="$value" -v n="$n" '
    !d && $0 ~ "^[[:space:]]*"k"[[:space:]]*=" { print k " = " v; d = 1; next }
    { print }
    n + 0 == 0 && !d && $0 ~ "^[[:space:]]*#[[:space:]]*"k"[[:space:]]*=" { print k " = " v; d = 1 }
    END { if (!d) print k " = " v }
  ' "$CONFIG" >"${CONFIG}.tmp"
  mv "${CONFIG}.tmp" "$CONFIG"

  echo "${key}: ${before:-未設定} → ${value}"
}

list_themes() {
  local pattern="${1:-}" dir
  dir=$(themes_dir)
  if [ -n "$pattern" ]; then
    ls "$dir" | grep -i "$pattern" || echo "(該当なし)"
  else
    ls "$dir"
  fi
}

# macOS のファイルシステムは大文字小文字を区別しないため、[ -f ] による存在確認では
# 'gruvbox light' のような表記ゆれが素通りし、正規名と違う文字列が設定に残る。
# 実ファイル名に正規化してから書き込む。
resolve_theme() {
  local dir
  dir=$(themes_dir)
  ls "$dir" | awk -v t="$1" 'BEGIN { lt = tolower(t) } !f && tolower($0) == lt { print; f = 1 }'
}

set_theme() {
  local theme="$1" canonical
  canonical=$(resolve_theme "$theme")

  if [ -z "$canonical" ]; then
    echo "Error: テーマ '$theme' が見つかりません" >&2
    echo "候補:" >&2
    list_themes "$theme" >&2
    exit 1
  fi

  set_value theme "$canonical"
}

reload_config() {
  if command -v cmux >/dev/null 2>&1; then
    # Reload Configuration ショートカットと同じ処理。アプリも端末セッションも再起動しない。
    cmux reload-config
  else
    echo "cmux CLI が無いため自動リロードできません。Ghostty で Cmd+Shift+, を押してください。"
  fi
}

[ $# -ge 1 ] || usage
[ -f "$CONFIG" ] || die "設定ファイルがありません: $CONFIG"

cmd="$1"
shift

case "$cmd" in
get)
  [ $# -ge 1 ] || die "キー名を指定してください"
  value=$(get_value "$1")
  echo "${value:-未設定}"
  ;;
set)
  [ $# -ge 2 ] || die "キー名と値を指定してください"
  key="$1"
  shift
  set_value "$key" "$*"
  ;;
theme)
  [ $# -ge 1 ] || die "テーマ名を指定してください"
  set_theme "$*"
  ;;
list)
  list_themes "${1:-}"
  ;;
reload)
  reload_config
  ;;
*)
  echo "Error: 不明なコマンド '$cmd'" >&2
  usage
  ;;
esac
