# gcloud-cli が Homebrew のサンドボックス化で壊れる問題

2026-08-09 に発生。上流が直るまでの暫定運用と、再発時の復旧手順を残す。

## 事象

`mise run tools:update` が最初のフェーズで止まり、`gcloud` が PATH から消える。

```
[brew:upgrade] $ brew upgrade --cask --greedy gcloud-cli
[brew:upgrade] Error: Cask 'gcloud-cli' is not installed.
```

`brew list --cask` には gcloud-cli が出るのに、`brew info --cask gcloud-cli` は "Not installed" を返す。
`/opt/homebrew/bin/{gcloud,bq,gsutil,docker-credential-gcloud,git-credential-gcloud}` と shell 補完が消える。
`/opt/homebrew/share/google-cloud-sdk` の実体は残るので、フルパスでなら gcloud は動く。

## 根本原因

Homebrew の commit `f8fcbd88e037084ce18d8db6161d42d921cadf13`（2026-08-07「Sandbox structured cask
operations」）以降、cask の `preflight_steps` と `postflight_steps` はサンドボックス内で実行される。
サンドボックスは `HOME` を一時ディレクトリへ差し替え（`cask/artifact/abstract_artifact.rb` の
`run_cask_sandbox`）、`deny_read_home` と `deny_all_network` を課す（`sandbox.rb` の
`add_install_hook_rules`）。

gcloud-cli の postflight は `gcloud config virtualenv` の delete・create・enable を実行する。virtualenv の
作成は pip による外部取得を伴うため、この条件では必ず失敗する。失敗すると `cask/installer.rb` の
ロールバックがバージョンディレクトリ・メタデータ・binary のシンボリックリンクを巻き戻す。
その結果、Caskroom には `.metadata/INSTALL_RECEIPT.json` と `latest` のリンク切れだけが残る。

Homebrew は `Cask#installed?` を `installed_caskfile&.exist?` で判定し（`cask/cask.rb`）、
そのケースファイルは `.metadata/<version>/<timestamp>/Casks/<token>.json` にある。これが無いため
「未インストール」と判定される。cask を名指しした `brew upgrade` は未インストールなら
`CaskNotInstalledError` で落ちる（`cask/upgrade.rb`）。

サンドボックスを無効化する手段は無い。`HOMEBREW_NO_SANDBOX_CASK` は `env_config.rb` に定義が残るだけで
コードからの参照が消えており（`odeprecated`）、`HOMEBREW_AVOID_NESTED_SANDBOXING` は `/opt/homebrew` の
ようなデフォルト prefix では `odie` で拒否される。

## 現在の暫定運用

- 上流定義から postflight の virtualenv 操作4つだけを削除した cask で再インストールしてある。
- `brew pin --cask gcloud-cli` で 579.0.0 に固定してある。
- gcloud 自体の更新は mise の `gcloud:upgrade`（`gcloud components update`）が担う。pin の影響を受けない。
- 新マシンでは `10-brew-bundle.sh` が `HOMEBREW_BUNDLE_CASK_SKIP=gcloud-cli` で導入を飛ばす。
  Brewfile の `cask "gcloud-cli"` は残してある。外すと `brew bundle cleanup` が未宣言 cask と見なす。

適用時点の値は次のとおり。

| 項目 | 値 |
|---|---|
| cask バージョン | 579.0.0 |
| tap_git_head | `7e03363501f67ac00f9b60a6a117131083579290` |
| ruby_source_checksum (sha256) | `f1fd2dd3b0837870a85d17d8f4a241a0ba6666544cb48c7ff54056d253b19648` |

差分は `docs/patches/gcloud-cli-579-no-virtualenv.patch` にある。これは証跡であって、そのまま将来に
再利用するものではない。上流定義が変われば当て方も変わるので、下の手順で毎回取り直す。

## 復旧手順

再発したとき、または新マシンで導入するときに使う。

### [1] 上流定義を取得して検証する

`main` ではなく API が返す `tap_git_head` に固定し、`ruby_source_checksum` で検証する。

```bash
D="$(mktemp -d)"; cd "$D"
brew info --json=v2 --cask gcloud-cli > gcloud-cli.json
HEAD=$(jq -r '.casks[0].tap_git_head' gcloud-cli.json)
SPATH=$(jq -r '.casks[0].ruby_source_path' gcloud-cli.json)
SSHA=$(jq -r '.casks[0].ruby_source_checksum.sha256' gcloud-cli.json)

curl --fail --location --proto '=https' --tlsv1.2 \
  "https://raw.githubusercontent.com/Homebrew/homebrew-cask/${HEAD}/${SPATH}" \
  --output gcloud-cli.upstream.rb
printf '%s  %s\n' "$SSHA" gcloud-cli.upstream.rb | shasum -a 256 -c -
```

### [2] postflight の virtualenv 操作を削除する

まず既存の patch が当たるか試し、当たれば適用する。当たらなければ上流が変わっているので、手で削除して
差分を作り直す。`--dry-run` だけで次の手順へ進むと、未改変のまま入れ直して同じ失敗を繰り返す。

```bash
mkdir -p Casks/g && cp gcloud-cli.upstream.rb Casks/g/gcloud-cli.rb
patch_file=~/other/dotfiles/docs/patches/gcloud-cli-579-no-virtualenv.patch
patch -p1 --dry-run < "$patch_file"   # 当たるか確かめる
patch -p1 < "$patch_file"             # 実際に当てる
```

削除するのは `postflight_steps` の中の `on_macos` ブロックだけである。その中にある
`gcloud config virtualenv` の delete・create・enable と `gcloud version` を消す。
`unless_path_exists "{{caskroom_path}}/latest"` の symlink 作成は必ず残す。今回の原因とは無関係な、
上流 cask 側の管理処理である。

ファイル名は `gcloud-cli.rb` にする。Homebrew はファイル名から token を決める。

```bash
diff -u gcloud-cli.upstream.rb Casks/g/gcloud-cli.rb   # 差分がこのブロックだけか目視する
```

### [3] 入れ直す

`latest` のリンク切れを手で消す必要はない。postflight の force symlink が張り直す。

```bash
HOMEBREW_DEVELOPER=1 brew reinstall --cask --force "$D/Casks/g/gcloud-cli.rb"
```

### [4] virtualenv をサンドボックスの外で整える

cask が実行できなかった後処理をここで補う。

```bash
/opt/homebrew/bin/gcloud components update-macos-python --quiet
```

### [5] 確認する

```bash
brew list --cask --versions gcloud-cli      # 手順1で取得した version が返る
brew doctor check_cask_corrupt_dirs         # "Your system is ready to brew."
command -v gcloud                           # /opt/homebrew/bin/gcloud
gcloud --version
gcloud config configurations list           # 既存機の復旧時のみ。設定済みのプロファイルが揃う
```

### [6] pin する

```bash
brew pin --cask gcloud-cli
```

`auto_updates true` の cask なので「Homebrew の外で自己更新しうる」という警告が出る。想定どおりである。

## 解除の判断

pin を外してよいのは、次のどちらかを確認できたときに限る。

- 上流 cask の postflight から、HOME 依存・ネットワーク依存の処理が消えるかサンドボックスの外へ移ったとき。
- Homebrew 本体側で、その処理を許可する修正が入ったとき。

バージョンが上がっただけでは条件を満たさない。版上げは `version` と `sha256` しか変えない。
判定は件数ではなく中身を目視する。件数だと、本体側の修正で安全になった場合や、別名のネットワーク依存
コマンドへ置き換わった場合を取り違える。`grep -c` は 0 件でも終了コード 1 を返すので使わない。

```bash
brew info --json=v2 --cask gcloud-cli \
  | jq '[.casks[0].artifacts[]? | .postflight_steps? // empty | .[].steps[]?
         | select(.type == "run") | {command, args, env, guards}]'
```

解除するときの手順は次のとおり。

```bash
brew unpin --cask gcloud-cli
brew reinstall --cask --force gcloud-cli
brew doctor check_cask_corrupt_dirs
```

あわせて次の3つを元に戻す。

- `home/.chezmoiscripts/run_onchange_after_10-brew-bundle.sh.tmpl` の `HOMEBREW_BUNDLE_CASK_SKIP` と警告
- `home/dot_config/mise/conf.d/gcloud.toml` の pin に関するコメントブロック
- この runbook と `docs/patches/` の patch

`brew cat --cask gcloud-cli` は API モードでは使えないので判断に使わない。

## 検知の仕組み

破損は mise の `brew:cask:check` が `brew doctor check_cask_corrupt_dirs` で検知する。全更新の完了後、
`brew autoremove` の手前で走る。破損した cask は Homebrew の依存グラフから消えるため、先に掃除を
走らせるとその cask だけが使う formula を誤って削除しうる。

pin は `brew upgrade` でも `brew bundle` でも沈黙する。`mise run brewfile:audit` の「pin 済み」欄でだけ
見える。

## 参考

- Homebrew の該当 commit — <https://github.com/Homebrew/brew/commit/f8fcbd88e037084ce18d8db6161d42d921cadf13>
- cask 定義 — <https://github.com/Homebrew/homebrew-cask/blob/main/Casks/g/gcloud-cli.rb>
- Google 公式の案内（導入は Homebrew、更新は `gcloud components update`） — <https://docs.cloud.google.com/sdk/docs/downloads-homebrew>
