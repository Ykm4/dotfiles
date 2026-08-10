---
name: self-review
description: Claude と Codex（公式プラグイン経由）が交互にコードレビューし、両者が LGTM になるまで反復改善する。コードレビュー、セルフレビュー、PRレビュー時に使用。
disable-model-invocation: true
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*), Bash(git merge-base:*), Bash(git ls-files:*), Read, Grep, Glob, Skill(codex:*)
---

# Self-Review: Claude + Codex 反復コードレビュー

Claude と Codex（公式プラグイン codex-plugin-cc 経由）が交互にコードレビューを行い、両者が LGTM と判定するまでレビューを反復する。コードの自動修正は行わない。

## ワークフロー

以下のフローを **最大 3 ラウンド** 実行する。

### Phase 1: 変更の収集

1. 起点ブランチを特定する

```bash
# 候補ブランチ（main, dev）との merge-base を調べ、最も近いものをベースとする
git merge-base HEAD main
git merge-base HEAD dev
```

2. ベースブランチとの差分・状態を取得する

```bash
git diff <base-commit>..HEAD
git diff                          # unstaged changes
git diff --staged                 # staged changes
git status
git log --oneline <base-commit>..HEAD
```

3. 変更量が大きい場合（500行超）は、ファイル単位で要約を作成する

### Phase 2: Claude によるレビュー

変更差分を以下のレビュー観点に基づいて分析する。指摘事項を **severity（Critical / Warning / Nit）** で分類する。

指摘を行う際は、必ず該当ファイルの関連コードを `Read` / `Grep` で確認し、diff だけでなく前後の文脈を踏まえて判断する。

### Phase 3: Codex によるレビュー

`/codex:review` を Skill ツール経由で呼び出し、Codex にコードレビューを依頼する。

```
Skill(codex:review, "--base <base-commit> --wait")
```

`<base-commit>` には Phase 1 で特定したベースブランチとの merge-base コミットを指定する。

Codex のレビュー結果を受け取ったら、以下の観点で不足がないか確認する:
1. ロジックの正確性・エッジケース
2. 型安全性（TypeScript）
3. エラーハンドリング
4. セキュリティ
5. アーキテクチャ整合性（Hexagonal Architecture / Ports & Adapters）
6. テストの妥当性

Codex のレビューでこれらの観点がカバーされていない場合は、`/codex:adversarial-review` で補完する:

```
Skill(codex:adversarial-review, "--wait 以下の観点を重点的にレビューしてください: {不足している観点}")
```

ラウンド 2 以降では、前ラウンドの指摘事項を踏まえて追加レビューを依頼する。

### Phase 4: レビュー結果の統合・判定

Claude と Codex 両方のレビュー結果を統合する。

1. 重複する指摘をマージする
2. 矛盾する指摘がある場合は、プロジェクトの規約・アーキテクチャパターンに基づいて Claude が最終判断する
3. 指摘事項を severity 順にソートする

#### 両者が LGTM の場合

Phase 5（最終サマリ）に進む。

#### 指摘事項がある場合

Codex と議論を重ねる。Claude の分析と Codex の指摘を突き合わせ、各指摘の妥当性を検証する。合意が得られたら次ラウンドに進む。

**コードの自動修正は行わない。** 指摘事項はユーザーへの報告のみとする。

### Phase 5: 最終サマリ出力

以下のフォーマットで最終結果を出力する。

```markdown
## Self-Review 完了

### 結果: LGTM / 要対応

| 項目 | 値 |
|------|-----|
| レビューラウンド数 | N |
| 指摘数（Critical） | N |
| 指摘数（Warning） | N |
| 指摘数（Nit） | N |

### 指摘事項（該当する場合のみ）

| # | Severity | ファイル | 行 | 指摘内容 | 推奨修正 |
|---|----------|---------|-----|---------|---------|
| 1 | Critical | path/to/file.ts | 42 | ... | ... |

### レビュー観点別サマリ

| 観点 | 結果 |
|------|------|
| 正確性 | OK / 要対応 [概要] |
| 型安全性 | OK / 要対応 [概要] |
| エラーハンドリング | OK / 要対応 [概要] |
| セキュリティ | OK / 要対応 [概要] |
| アーキテクチャ | OK / 要対応 [概要] |
| テスト | OK / 要対応 [概要] |
```

## レビュー観点チェックリスト

### 1. 正確性（Correctness）

- ロジックにバグがないか
- エッジケース（null, undefined, 空配列, 境界値）が考慮されているか
- 非同期処理が正しく await されているか（noFloatingPromises）
- 副作用が意図通りか

### 2. 型安全性（Type Safety）

- `any` が使用されていないか（noExplicitAny）
- 型アサーション（`as`）が安全か
- `null` / `undefined` チェックが適切か（noNonNullAssertion）
- import type が正しく使用されているか（useImportType）

### 3. エラーハンドリング（Error Handling）

- DomainError / InfrastructureError の使い分けが正しいか
- エラーが適切にラップ・伝播されているか
- エラーコードが規約に従っているか
- try-catch のスコープが適切か

### 4. セキュリティ（Security）

- 機密情報がハードコードされていないか
- 入力バリデーションが十分か（Zod schema）
- インジェクション脆弱性がないか
- 暗号化パターンが守られているか（個人情報は Repository 層で暗号化）

### 5. アーキテクチャ整合性（Architecture）

- 依存の方向が内側（Core）に向いているか
- Port / Adapter の責務分離が守られているか
- Core が FW / ORM / 外部ライブラリに依存していないか
- DI が container.ts で正しく組み立てられているか
- Mapper は純粋関数か
- ファイル名が kebab-case か（useFilenamingConvention）

### 6. テスト（Testing）

- 変更に対応するテストが存在するか
- テストがコロケーションパターンで配置されているか（`*.test.ts`）
- テストが実装の内部に依存していないか（ブラックボックステスト）
- エッジケースがテストされているか

## ラウンド上限到達時の動作

3 ラウンド実行後も LGTM に到達しない場合:

1. 残存する指摘事項を severity 順に一覧出力する
2. 各指摘に対する推奨修正を記載する
3. 最終サマリを「要対応」として出力する

## 注意事項

1. コードの自動修正は行わない。レビューと指摘のみ
2. Codex の提案と Claude の分析が矛盾する場合は、プロジェクトの規約を優先する
3. 大規模な変更（30 ファイル超）の場合は、モジュール単位でレビューを分割する
4. 最終判断はユーザーが行う
