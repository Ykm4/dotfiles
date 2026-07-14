---
name: recover
description: "スキルの自己回復。直近のセッションからエラーを検出し、原因を特定してスキルのスクリプト・設定を自動修正する。「回復」「recover」「エラー直して」「スキルが動かない」で使用。"
disable-model-invocation: true
allowed-tools: Bash(bun *), Bash(which *), Bash(command *), Bash(chmod *), Read, Edit, Write, AskUserQuestion
---

# Self-Recovery: セッションエラーからの自己回復

## 概要

直近のセッション履歴を解析し、スキル実行時のエラーを検出・修正する。

## ワークフロー

### Step 1: セッション解析

直近のセッション JSONL からエラーを検出する:

```bash
bun run ~/.claude/skills/recover/scripts/analyze-sessions.ts --minutes 120
```

出力は JSON 形式:
- `errors`: 検出されたエラー一覧（エラー種別・メッセージ・関連スキル・関連ファイル）
- `affected_skills`: エラーが発生したスキル名一覧
- `session_count`: 解析したセッション数

エラーが0件の場合は「直近のセッションでエラーは検出されませんでした」と報告して終了。

### Step 2: 影響範囲の特定

検出された `affected_skills` ごとに:

1. スキルのディレクトリ構造を確認: `~/.claude/skills/{skill_name}/`
2. `related_files` に挙がったファイルを Read で読み込む
3. SKILL.md も Read で確認する

### Step 3: エラー原因の分析

エラー種別ごとの分析アプローチ:

| error_type | 原因の特定方法 |
|-----------|---------------|
| `command_not_found` | コマンド名の誤り、PATH の問題、パッケージ未インストール。`which` や `command -v` で正しいコマンドを探す |
| `exit_code` | スクリプトの実行エラー。エラーメッセージと該当スクリプトを照合 |
| `runtime_error` | ロジックエラー、API変更、外部サービスの問題。エラーメッセージから原因を推測 |

### Step 4: 修正の提案と実行

1. エラーの原因と修正案をユーザーに提示する（AskUserQuestion で承認）
2. 承認されたら Edit / Write でファイルを修正
3. 修正可能な場合はスクリプトの実行権限も確認: `chmod +x`

### Step 5: 知見の蓄積

修正を適用した後、該当スキルの `references/troubleshooting.md` に知見を追記する。
ファイルが存在しない場合は新規作成する。

追記フォーマット:
```markdown
### {日付}: {エラー概要}

- **症状**: {エラーメッセージ}
- **原因**: {原因の説明}
- **修正**: {修正内容}
- **対象ファイル**: {修正したファイルパス}
```

## 注意事項

1. 修正は必ずユーザーの承認を得てから適用する
2. 破壊的な変更（ファイル削除、大幅な書き換え）は避け、最小限の修正に留める
3. 原因が外部要因（サービス障害、ネットワーク問題等）の場合は修正不要。報告のみ
4. 複数のスキルでエラーが検出された場合は、影響の大きいものから順に対処
