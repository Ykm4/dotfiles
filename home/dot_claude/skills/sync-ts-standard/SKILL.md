---
name: sync-ts-standard
description: TypeScript コーディング規約の双方向同期。コード変更からルールを更新提案（c2r）、ルールからプロジェクト設定を同期（r2p）、準拠状況レポート（status）。
argument-hint: "[c2r|r2p|status]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git diff:*), Bash(git log:*), Bash(git status:*), AskUserQuestion
---

# Sync TypeScript Standards

TypeScript コーディング規約（`~/.claude/rules/typescript-standards.md`）とプロジェクトコード/設定の双方向同期を行う。

## 使用方法

```
/sync-ts-standard c2r       # Code → Rules: コードのパターンからルール更新を提案
/sync-ts-standard r2p       # Rules → Project: ルールからプロジェクト設定を生成/更新
/sync-ts-standard status    # 現在のルールとプロジェクト設定の差分レポート（変更なし）
```

引数なしの場合は AskUserQuestion で選択肢を提示する。

---

## Direction 1: Code → Rules (c2r)

コードの実態からコーディング規約に反映されていないパターンを検出し、ルールの追加・更新を提案する。

### Step 1: 分析対象の収集

1. 引数でファイルパスが指定されている場合はそのファイルを対象とする
2. 指定がない場合は最近の git 変更を分析する:
   ```bash
   git diff HEAD~10 --name-only -- '*.ts' '*.tsx'
   git diff --staged --name-only -- '*.ts' '*.tsx'
   ```
3. 変更されたファイルを Read で読み込む（最大 20 ファイル）

### Step 2: パターン検出

対象ファイルを分析し、以下の観点でパターンを検出する:

| カテゴリ | 検出項目 |
|---------|---------|
| 型の使い方 | any / as / ! の使用有無、unknown + 型ガードの使用、enum vs as const |
| 構文スタイル | forEach vs for...of、default export vs named export |
| 命名 | ファイル名ケース、boolean プレフィクス |
| 設計 | early return パターン、パラメータ数、options object |
| 非同期 | Promise.all / allSettled の使い分け |
| モジュール | barrel file (index.ts) の使い方 |

### Step 3: ルールとの差分比較

1. 現在のルールファイルを Read で読み込む:
   ```
   ~/.claude/rules/typescript-standards.md
   ```
2. 検出したパターンとルールを比較し、以下を分類する:
   - **新パターン**: コードに存在するがルールに記載されていないパターン
   - **矛盾**: コードのパターンがルールと矛盾しているケース
   - **準拠**: ルールに合致しているパターン

### Step 4: 報告と適用

1. 検出結果をテーブル形式で報告:

```markdown
| # | カテゴリ | 検出パターン | ルール状態 | 提案 |
|---|---------|-------------|-----------|------|
| 1 | 型 | Result<T> ユーティリティ型 | 未カバー | 追加 |
| 2 | 命名 | useXxx フック命名 | 未カバー | 追加 |
| 3 | 型 | as で JSON パース結果をキャスト | 矛盾 | 要確認 |
```

2. AskUserQuestion で適用方法を確認:
   - 全て適用
   - 個別選択
   - キャンセル
3. 承認されたものだけ Edit で `~/.claude/rules/typescript-standards.md` を更新

**重要**: ルールの自動更新は絶対に行わない。必ずユーザーの確認後に適用する。

---

## Direction 2: Rules → Project (r2p)

コーディング規約を読み取り、プロジェクトの設定ファイルを規約に合わせて更新する。

### Step 1: プロジェクト設定の検出

プロジェクトルートで設定ファイルを自動検出する:

```
Glob: tsconfig.json, tsconfig.*.json
Glob: biome.json, biome.jsonc
Glob: eslint.config.*, .eslintrc.*
Glob: .prettierrc*, prettier.config.*
```

検出された設定ファイルを全て Read で読み込む。

### Step 2: ルールから設定へのマッピング

`~/.claude/rules/typescript-standards.md` を読み込み、各ルールを設定値にマッピングする。

#### tsconfig.json マッピング

コーディング規約自体には tsconfig 設定を含めていないが、規約の前提として以下を推奨設定として提案する:

| 設定 | 推奨値 | 理由 |
|------|-------|------|
| strict | true | 型安全性ルールの前提 |
| noUncheckedIndexedAccess | true | 配列/Record アクセスの安全性 |
| verbatimModuleSyntax | true | import type の強制 |

#### Biome マッピング

| ルール | Biome 設定 |
|--------|-----------|
| any 禁止 | `suspicious.noExplicitAny: "error"` |
| as 禁止 | `suspicious.noExtraNonNullAssertion: "error"`, コードレビューで対応 |
| 非null ! 禁止 | `style.noNonNullAssertion: "error"` |
| forEach → for...of | `complexity.noForEach: "error"` |
| kebab-case ファイル名 | `style.useFilenamingConvention: { "strictCase": false, "filenameCases": ["kebab-case"] }` |
| named export | `style.noDefaultExport: "error"`（override で FW ファイルは除外） |
| barrel file 制限 | `performance.noBarrelFile: "error"` |

#### ESLint マッピング

| ルール | ESLint 設定 |
|--------|-----------|
| any 禁止 | `@typescript-eslint/no-explicit-any: "error"` |
| as 禁止 | `@typescript-eslint/consistent-type-assertions: ["error", { "assertionStyle": "never" }]` |
| 非null ! 禁止 | `@typescript-eslint/no-non-null-assertion: "error"` |
| forEach → for...of | `no-restricted-syntax` で .forEach を禁止 |
| named export | `import/no-default-export: "error"` |

### Step 3: 差分レポート

現在の設定と規約準拠の設定を比較し、ファイルごとに差分を報告する:

```markdown
## tsconfig.json

| 設定 | 現在値 | 推奨値 | 状態 |
|------|-------|-------|------|
| strict | true | true | OK |
| noUncheckedIndexedAccess | - | true | 未設定 |

## biome.jsonc

| ルール | 現在値 | 推奨値 | 状態 |
|--------|-------|-------|------|
| noExplicitAny | warn | error | 要更新 |
| noNonNullAssertion | - | error | 未設定 |
```

### Step 4: 適用

1. AskUserQuestion で適用範囲を確認:
   - 全ファイル適用
   - ファイル個別選択
   - キャンセル
2. 承認されたファイルのみ Edit で更新
3. 変更サマリを出力

**重要**:
- 設定ファイルが存在しない場合は新規作成を提案する（自動作成しない）
- プロジェクト固有の設定（overrides, excludes, paths, extends 等）は変更しない
- `node_modules` 内は絶対に変更しない

---

## status サブコマンド

現在のルールとプロジェクト設定の準拠状況をレポートする。**変更は一切行わない。**

1. ルールファイルを Read で読み込む
2. プロジェクト設定ファイルを自動検出・Read で読み込む
3. 各ルールの準拠状況を分類:
   - **OK**: 設定が規約に準拠
   - **要更新**: 設定が規約と不一致
   - **未設定**: 対応する設定が存在しない
   - **N/A**: 該当ツールがプロジェクトに存在しない
4. テーブル形式で出力

---

## エラーハンドリング

- ルールファイルが存在しない場合: 初回セットアップを案内し、`~/.claude/rules/typescript-standards.md` の作成を提案
- 設定ファイルが一つも存在しない場合: プロジェクトのツールチェーン選定を先に行うよう案内
- git リポジトリでない場合（c2r）: ファイルパス指定での分析を案内
