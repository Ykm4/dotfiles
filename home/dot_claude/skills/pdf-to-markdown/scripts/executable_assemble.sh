#!/usr/bin/env bash
# 使い方: assemble.sh <version-dir> <version-label>
# <version-dir>/pages/page-*.md を結合し <version-dir>/<label>.md を作る
set -euo pipefail
vdir="${1:?usage: assemble.sh <version-dir> <version-label>}"
label="${2:?usage: assemble.sh <version-dir> <version-label>}"

shopt -s nullglob
mapfile -t pages < <(printf '%s\n' "$vdir"/pages/page-*.md | sort)
if [ "${#pages[@]}" -eq 0 ]; then
  echo "ERROR: ${vdir}/pages/ に page-*.md がありません"; exit 1
fi

out="${vdir}/${label}.md"
{
  echo "# ${label}"
  echo
  echo "> 自動生成(pdf-to-markdownスキル)。原文PDFの忠実ミラー。詳細な出典は _source.md を参照。"
  echo
  for f in "${pages[@]}"; do
    cat "$f"
    printf '\n\n'
  done
} > "$out"
echo "assembled ${#pages[@]} pages -> ${out}"

# ページ跨ぎで分断された連続テーブルを結合する
if command -v python3 >/dev/null 2>&1; then
  python3 "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/stitch.py" "$out"
else
  echo "WARN: python3が無いためテーブル結合(stitch)をスキップしました" >&2
fi
