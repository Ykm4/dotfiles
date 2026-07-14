#!/usr/bin/env bash
# 使い方: preflight.sh <pdf>
# ページ数・テキスト層の有無・版表記を出力する
set -euo pipefail
pdf="${1:?usage: preflight.sh <pdf>}"

command -v pdfinfo >/dev/null 2>&1 || { echo "ERROR: poppler未導入。'brew install poppler' を実行してください"; exit 1; }

pages="$(pdfinfo "$pdf" | awk '/^Pages:/{print $2}')"
chars="$(pdftotext "$pdf" - 2>/dev/null | tr -d '[:space:]' | wc -c | tr -d ' ')" || chars=0
if [ "${chars:-0}" -lt 100 ]; then
  layer="NONE (スキャンPDFの可能性。vision専用で処理)"
else
  layer="present (${chars} chars)"
fi
ver="$(pdftotext -f 1 -l 3 "$pdf" - 2>/dev/null | python3 -c "
import sys, unicodedata, re
text = unicodedata.normalize('NFKC', sys.stdin.read())
m = re.search(r'[Vv]er\.?\s*[\d]+(?:\.\d+)*', text)
print(m.group(0) if m else '')
" 2>/dev/null || true)"

echo "pages: ${pages}"
echo "text-layer: ${layer}"
echo "version-hint: ${ver:-(不明。手動指定が必要)}"
