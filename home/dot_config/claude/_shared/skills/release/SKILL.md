---
name: release
description: >-
  リポジトリの新しいバージョン(gitタグ・GitHub Release)を出すときに使う。
when_to_use: >-
  「リリースして」「タグを切って」「新しいバージョンを出す」「release」と言われたとき、
  または main に未リリースのコミットが溜まっていてリリースを提案したいとき。
argument-hint: "[major|minor|patch|(省略で自動判定)]"
allowed-tools: Bash(git log:*), Bash(git status:*), Bash(git tag:*), Bash(git diff:*), Bash(gh release list:*), Bash(gh release view:*), Bash(gh release create:*), Bash(gh release edit:*), Bash(gh run list:*), Bash(gh auth status)
---

# release — バージョン判定とノート起草を自動化したリリース

判断(bump とノート)は AI が用意し、人間は確認・承認だけを行う。**承認前に実行しない**のがこのスキルの鉄則。

## Step 1: 状態を集める(読み取りのみ)

- 直近タグ: `git tag -l --sort=-v:refname | head -3`
- 未リリースのコミット: `git log <直近タグ>..HEAD --oneline`(0件なら「リリースするものがない」と報告して終了)
- 前提: `git status`(クリーンか・main か)、`gh auth status`、直近 CI(`gh run list -L1`)が緑か
- リリース対象は push 済みかつ CI 緑のコミットに限る。未 push のコミットがある場合(status が ahead)は、先に push して CI の成功を確認してから続行する(ローカルのテストが緑でも CI の Node マトリクスで落ちた実例があるため。タグは semver 解決の配布点なので、壊れたコミットに打ってはならない)
- ノートの流儀: `gh release view <直近タグ>` で既存リリースの見出し構成・言語を確認する

## Step 2: bump を判定する

コミットのラベルではなく**変更の実質**で判断する(refactor と書かれていても公開 API・出力・既定動作の互換を壊すなら major)。

| bump | 基準 |
| --- | --- |
| major | 互換を壊す変更が1つでもある(API・出力形式・既定動作・対応環境の切り下げ) |
| minor | 後方互換の機能追加(feat)。lint 設定ならルール・辞書の追加もここ(検出が増える旨をノートに明記) |
| patch | 上記以外(fix・docs・chore・内部 refactor) |

引数で bump が指定されていれば判定を省略してよいが、実質と食い違うときは指摘する。

## Step 3: 提示して承認を待つ(鉄則)

次を提示し、**明示的な承認を得るまで実行系のコマンドを一切叩かない**。

- 新バージョンと bump の根拠(判定に使ったコミットを添える)
- リリースノート案 — 既存リリースのスタイルを踏襲する。前例が無ければ日本語で「追加/変更/修正/注意」の節構成

## Step 4: 実行する(承認後)

- リポジトリに `mise run release <bump>` タスクがあればそれを使う。無ければ `npm version <bump>`(preversion/postversion の中身を先に確認)。どちらも無ければ実行せず、リリース手順の整備から提案する
- 自動生成ノートで Release が作られる場合は、承認済みのノート案で差し替える: `gh release edit v<version> --notes-file <案>`

## Step 5: 事後確認

タグ(`git tag -l`)・Release(`gh release view`)・CI(`gh run list -L1`)を確認して結果を報告する。

## postversion の push が失敗したとき

単発の `git push` が権限で拒否される環境でも、リリースタスク内にネストした push は通ることがある(実測)。失敗した場合のみ復旧する。`npm version` はローカルの commit+tag まで成功しているので:

1. ユーザーに `! git push origin main --follow-tags` の実行を依頼する
2. push 確認後、`gh release create v<version> --title v<version> --notes-file <承認済み案>` を自分で実行する

## Red Flags — これが頭をよぎったら Step 3 に戻る

- 「変更が自明だから確認は省略していい」→ 承認は毎回必須。確認が速いのは提示が的確なとき
- 「時間がないのでそのまま実行」→ 提示と承認は1往復で終わる。省略で失うものの方が大きい
- 「refactor と書いてあるから patch」→ ラベルでなく実質で判定する
