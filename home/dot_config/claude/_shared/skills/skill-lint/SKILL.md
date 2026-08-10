---
name: skill-lint
description: >-
  Claude Code スキルの構文・構造・品質を検証する。
  Bun スクリプトで静的解析を実行し、Claude が内容品質のフィードバックを追加する。
  「スキル 検証」「lint skill」「スキル チェック」「validate skill」で使用。
argument-hint: "[スキルディレクトリのパス...] or 省略で全スキル"
allowed-tools: Bash(bun run *skill-lint/scripts/*), Read, Glob, Grep
---

## ワークフロー

### Step 1: 対象スキルの特定

- 引数がある場合: 指定されたパスを対象とする
- 引数がない場合: `~/.claude/skills/*/` 配下の全スキルを対象とする（symlink 含む）

### Step 2: 静的解析の実行

以下のコマンドで Bun スクリプトを実行:

```bash
bun run ~/.claude/skills/skill-lint/scripts/lint.ts <対象パス...>
```

結果をそのまま出力する。

### Step 3: 品質フィードバック（warning/error があるスキルのみ）

静的解析で問題が見つかったスキルについて、SKILL.md を Read で読み、以下を追加チェック:

1. **description の質** — WHAT（何をするか）と WHEN（いつ使うか・トリガーキーワード）が具体的に書かれているか
2. **ワークフローの明確性** — 手順が追えるか、sequential/conditional パターンが適切か
3. **progressive disclosure** — body に詰め込みすぎず references に適切に分離されているか
4. **改善提案** — 具体的な修正案を箇条書きで出力

### 出力フォーマット

```
## 静的解析結果
（Step 2 の出力をそのまま表示）

## 品質フィードバック
### [スキル名]
- description: ...の改善提案
- 構造: ...の改善提案
```
