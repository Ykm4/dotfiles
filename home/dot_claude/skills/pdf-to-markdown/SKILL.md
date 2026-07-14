---
name: pdf-to-markdown
description: Use when converting a specification PDF (table-heavy, born-digital) into a faithful Markdown mirror, and when comparing multiple versions of the same spec. Renders each page to an image and transcribes it visually for high fidelity. Triggers include "PDFをMarkdownに変換", "仕様書PDFを整理", "JAHIS仕様書をMD化", "版間差分".
---

# PDF→Markdown 変換スキル

仕様書PDFを原文忠実なMarkdownミラーに変換し、版がそろえば差分も作る。依存は poppler(`pdftoppm`/`pdftotext`/`pdfinfo`)のみ。

## 適用条件
- 表多用の仕様書PDFをMarkdownに整理したいとき。
- 同一仕様書の複数版を比較したいとき。
- PDF生成・フォーム記入・署名は対象外(別スキル)。

## 全体フロー(PDF 1本)
1. プリフライト: `scripts/preflight.sh <pdf>` でページ数・テキスト層・版表記を確認する。
2. レンダリング: `scripts/render.sh <pdf> <version-dir> 200` で全ページをPNG化する。
3. テキスト下書き: `scripts/text-draft.sh <pdf> <version-dir>` で下書きを出す。
4. 目視書き起こし: 各ページのPNGをReadで開き、下書きを参照して `pages/page-NN.md` を書く。規約は references/fidelity-rules.md に従う。複雑表は2パス検証。
5. 結合: `scripts/assemble.sh <version-dir> <label>` で `<label>.md` を作る(ページ跨ぎで分断された連続テーブルは `scripts/stitch.py` が自動結合する)。
6. メタ記録: references/output-structure.md の様式で `_source.md` と `specs/_index.md` を更新する。
7. 差分: 2版以上そろったら references/diff-guide.md に従い `diff/<vA>-vs-<vB>.md` を作る。

## 詳細リファレンス
- 書き起こし規約: references/fidelity-rules.md
- 出力構造・命名・メタ様式: references/output-structure.md
- 版間差分の手順: references/diff-guide.md
- トラブルシューティング: references/troubleshooting.md

## 運用上の注意
- Readツールは直接PDFを開けない環境がある。必ず render.sh でPNG化してから読む。
- 高忠実は高コスト。まず1版をパイロットで通してからバッチ処理する。
- 中間物(_work/)はGit管理外。
