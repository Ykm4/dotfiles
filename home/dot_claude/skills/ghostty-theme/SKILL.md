---
name: ghostty-theme
description: Ghosttyターミナルのテーマ変更・検索・確認。「テーマ変更」「theme」「ghostty」「ダーク」「ライト」「明るく」「暗く」で使用。
---

# Ghostty Theme

Ghosttyのテーマを管理するスキル。

## 設定

- 設定ファイル: `~/.config/ghostty/config`
- テーマディレクトリ: `/Applications/Ghostty.app/Contents/Resources/ghostty/themes/`
- リロード: `Cmd+Shift+,`

## ユーザーの好み

- ダーク: `GitHub Dark Dimmed`
- ライト: `Gruvbox Light`

## 使い方

スクリプト `scripts/ghostty-theme.sh` を使用する。

```bash
# 現在のテーマ確認
scripts/ghostty-theme.sh current

# テーマ変更
scripts/ghostty-theme.sh set "Gruvbox Light"

# テーマ検索
scripts/ghostty-theme.sh search gruvbox

# テーマ一覧
scripts/ghostty-theme.sh list
```

テーマ名が存在しない場合、候補を表示する。変更後は `Cmd+Shift+,` でリロードするようユーザーに伝える。
