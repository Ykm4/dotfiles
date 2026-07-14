---
description: notes リポジトリにメモを作成
allowed-tools: Read, Write, Bash(TZ=Asia/Tokyo date:*), Glob, Grep, AskUserQuestion, mcp__context7__resolve-library-id, mcp__context7__query-docs, WebSearch
argument-hint: [タイトル]
---

## 保存先

~/other/documents/notes/

## テンプレート一覧

@~/other/documents/notes/templates/ のファイルを参照：

| テンプレート | 保存先 | 用途 |
|-------------|--------|------|
| tech-research | work/tech/ | 技術調査・学習 |
| troubleshoot | work/tech/ | トラブルシュート |
| design | work/projects/ | 設計・アーキテクチャ |
| tool-setup | work/tools/ | ツール・環境設定 |
| finance-research | personal/finance/ | 資産運用調査 |
| finance-review | personal/finance/ | 資産運用定期レビュー |

## 記述ガイドライン

ノートは**汎用的なナレッジ**として記録する：

1. **プロジェクト非依存**: 特定プロジェクトのパスや設定は含めない
2. **自己完結**: コンテキストなしで理解できる内容にする
3. **具体例を含める**: コード例は汎用的なサンプルを使用
4. **Why を記録**: なぜその技術/手法を使うのかを明記
5. **再利用可能**: 別プロジェクトでも参照できる形式で記述

## タスク

### 1. 既存コンテンツの確認

タイトルのキーワードで notes リポジトリ内を検索（Grep, Glob）：
- 関連ファイルが存在する場合 → AskUserQuestion で確認：
  - 「既存ファイルを更新」
  - 「新規ファイルを作成」
  - 「キャンセル」
- 存在しない場合 → 新規作成へ進む

### 2. テンプレート選択

AskUserQuestion で以下から選択させる：
- 質問1（カテゴリ）: header="カテゴリ", options=["技術系 (調査/トラブル/設計/ツール)", "その他（技術系以外）"]
- 質問2（テンプレート）: カテゴリに応じて具体的なテンプレートを選択
  - 技術系: ["技術調査・学習", "トラブルシュート", "設計・アーキテクチャ", "ツール・環境設定"]
  - その他: ["調査・分析", "定期レビュー"]

### 3. タイトル取得

引数があればそれを使用、なければ質問

### 4. 内容の調査と作成

**技術系テンプレートの場合**:
1. Context7 MCP を使用して調査:
   - `mcp__context7__resolve-library-id` でライブラリIDを取得
   - `mcp__context7__query-docs` で公式ドキュメントから情報取得
2. 調査結果でテンプレートの各セクションを埋める
3. 参考リンクには**公式ドキュメントのURL**を設定（他プロジェクトのファイルパスは使用しない）

**その他（技術系以外）の場合**:
1. WebSearch で関連情報を調査（必要に応じて）
2. テンプレートを埋める

### 5. ファイル作成

- テンプレートを読み込み、frontmatter の日付を今日の日付（JST）で置換
- ファイル名: `{タイトル}.md` 形式（日付はfrontmatterで管理）
- 適切なディレクトリに保存

引数（タイトル）: $ARGUMENTS
