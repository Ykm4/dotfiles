#!/usr/bin/env bash
# 使い方: text-draft.sh <pdf> <outdir>
# 各ページを <outdir>/_work/text/page-NN.txt に出力する(vision書き起こしの下書き)
set -euo pipefail
pdf="${1:?usage: text-draft.sh <pdf> <outdir>}"
outdir="${2:?usage: text-draft.sh <pdf> <outdir>}"

command -v pdfinfo >/dev/null 2>&1 || { echo "ERROR: poppler未導入。'brew install poppler' を実行してください"; exit 1; }

pages="$(pdfinfo "$pdf" | awk '/^Pages:/{print $2}')"
width="${#pages}"
dir="${outdir}/_work/text"
mkdir -p "$dir"
for p in $(seq 1 "$pages"); do
  n="$(printf "%0${width}d" "$p")"
  pdftotext -f "$p" -l "$p" -layout "$pdf" "${dir}/page-${n}.txt"
done
echo "wrote ${pages} text drafts -> ${dir} (zero-pad width=${width})"
