# トラブルシューティング(troubleshooting)

## poppler未導入
症状: `pdftoppm`/`pdfinfo`/`pdftotext` が見つからない。
対処: `brew install poppler`。

## Readツールが直接PDFを開けない
症状: Readツールで `.pdf` を開くと `pdftoppm is not installed` エラー。
原因: Readツール内部のレンダラがサンドボックス化されたPATHで動き、homebrewの `/opt/homebrew/bin` を参照できない。
対処: 本スキルのとおり `render.sh` で自前でPNG化し、PNGをReadで読む。

## スキャンPDF(テキスト層なし)
症状: `preflight.sh` の text-layer が NONE。
対処: 下書き(pdftotext)は使わずvision専用で書き起こす。文字の埋め込み抽出が必要なら `brew install tesseract` でOCRを検討。

## 大規模PDF・中断と再開
- ページ単位でMDを書くため、`pages/page-NN.md` が既にあるページはスキップして再開できる。
- 版ごとに進捗(処理済みページ数/総ページ数)を報告する。

## トークン・時間コスト
- 高忠実(全ページvision)は版数×ページ数に比例して大きい。
- まず1版をパイロットで通し、書き起こし規約を固めてから残りをバッチ処理する。
