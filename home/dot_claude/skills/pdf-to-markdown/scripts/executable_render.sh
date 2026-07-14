#!/usr/bin/env bash
# 使い方: render.sh <pdf> <outdir> [dpi]
# 全ページを <outdir>/_work/png/page-NN.png に出力する
set -euo pipefail
pdf="${1:?usage: render.sh <pdf> <outdir> [dpi]}"
outdir="${2:?usage: render.sh <pdf> <outdir> [dpi]}"
dpi="${3:-200}"

command -v pdftoppm >/dev/null 2>&1 || { echo "ERROR: poppler未導入。'brew install poppler' を実行してください"; exit 1; }

work="${outdir}/_work/png"
mkdir -p "$work"
pdftoppm -png -r "$dpi" "$pdf" "${work}/page"
count="$(find "$work" -name 'page-*.png' | wc -l | tr -d ' ')"
echo "rendered ${count} pages -> ${work} (dpi=${dpi})"
