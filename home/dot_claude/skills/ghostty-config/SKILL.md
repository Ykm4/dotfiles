---
name: ghostty-config
description: Ghostty / cmux ターミナルの設定変更・確認。「テーマ変更」「theme」「フォントサイズ」「font-size」「ghostty」「cmux」「ダーク」「ライト」「明るく」「暗く」「文字を大きく」「文字を小さく」で使用。
---

# Ghostty Config

Ghostty設定ファイルを管理するスキル。cmuxはGhosttyベースで同じ設定ファイルを読むため、変更はGhosttyとcmuxの両方に反映される。

## 設定の構造

設定は2層に分かれている。ターミナルの見た目を決めるのはcmux.jsonではなくGhosttyの設定ファイルである。

| 変更したいもの | 編集先 |
|---|---|
| テーマ、フォント、透明度、背景のぼかし、カーソル、スクロールバック | `~/.config/ghostty/config`（本スキル） |
| サイドバー、通知、ショートカット、ブラウザ挙動 | `~/.config/cmux/cmux.json`（本スキルの対象外） |

テーマファイルはcmux.appから優先して読み、なければGhostty.appから読む。同梱テーマは同一のため、どちらを参照してもテーマ名は変わらない。

## ユーザーの好み

- ダーク: `GitHub Dark Dimmed`
- ライト: `Gruvbox Light`

## 使い方

```bash
scripts/ghostty-config.sh get theme            # 設定値を表示
scripts/ghostty-config.sh set font-size 11     # 設定値を変更
scripts/ghostty-config.sh theme "Gruvbox Light"
scripts/ghostty-config.sh list gruvbox         # テーマ検索（パターン省略で全件）
scripts/ghostty-config.sh reload               # 設定を反映
```

テーマの変更は`set`ではなく`theme`を使う。存在しないテーマ名なら候補を表示し、大文字小文字の表記ゆれは実際のテーマ名へ自動でそろえる。

cmux独自キーも`set`で扱える。

- `sidebar-font-size`
- `surface-tab-bar-font-size`
- `split-divider-color`

## 反映

変更後は必ず`reload`を実行する。cmux CLIがあれば`cmux reload-config`を呼ぶ。これはReload Configurationショートカットと同じ処理で、アプリと端末セッションのどちらも再起動しない。cmux CLIがない場合は`Cmd+Shift+,`を押すようユーザーに伝える。

## 注意点

- `font-family`や`keybind`のように有効な行が複数あるキーは、意図しない上書きを避けるため自動編集せずエラーで終了する。
- `font-size`は小数も指定できる（高DPI表示での半ポイント指定に対応）。
- 検証時は環境変数`GHOSTTY_CONFIG`で対象ファイルを差し替えられる。
