# 出力構造(output-structure)

変換成果物はリポジトリ直下の `specs/` に置く(設計ドキュメント置き場 `docs/superpowers/specs/` とは別物)。

## レイアウト
```
specs/
├── _index.md                   # 変換済み仕様書のカタログ
└── <doc-slug>/                 # 例: jahis-okusuri-techo
    ├── <version>/              # 例: v2.6
    │   ├── <version>.md        # 結合済み忠実ミラー(コミット対象)
    │   ├── pages/page-NN.md    # ページ単位(コミット対象)
    │   ├── _source.md          # 出典メタ
    │   └── _work/              # 中間PNG/テキスト(Git管理外)
    └── diff/
        └── <vA>-vs-<vB>.md
```

## 命名
- doc-slug: 英小文字ケバブ(例: jahis-okusuri-techo)。
- version: 原文の版表記を英小文字化(例: Ver.2.6 → v2.6)。
- page-NN: ゼロ埋め幅は総ページ数の桁数に合わせ、pdftoppmの出力と一致させる。

## _source.md の様式
```markdown
# 出典
- ファイル名: <元PDFのファイル名>
- SHA256: <sha256sum>
- 版: <version>
- 発行日: <YYYY-MM>
- 取得元URL: <あれば>
- 生成日: <YYYY-MM-DD>
- 生成方法: pdf-to-markdownスキル(dpi=200, 目視書き起こし)
```

## _index.md の様式
```markdown
# 変換済み仕様書カタログ
| doc-slug | 版 | ページ数 | 生成日 | 備考 |
|---|---|---|---|---|
| jahis-okusuri-techo | v2.6 | 47 | 2026-06-15 | パイロット |
```
