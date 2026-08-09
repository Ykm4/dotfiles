# Google Cloud CLI を Homebrew で管理しない理由と、その運用

2026-08-09にHomebrew caskからGoogle公式のversioned archiveへ移行した。その判断の記録と、
導入・更新・復旧の手順を残す。

## 責務の分担

| 対象 | 担当 |
|---|---|
| SDK 本体 | Google 公式 archive（`.chezmoiscripts/run_after_90-gcloud-install.sh`が seed 導入） |
| 更新 | `gcloud components update`（mise の`gcloud:upgrade`） |
| 実行に使う Python | Homebrew の`python@3.14`（Brewfile に直接宣言） |
| PATH と補完 | `.zshenv`の`GCLOUD_SDK_ROOT`と`.zshrc` |
| 認証 | mise の`google:auth` / `google:gcloud`（gws の資格情報を都度渡す） |

SDKの実体は`~/.local/share/google-cloud-sdk`、設定と認証情報は`~/.config/gcloud`にある。
この2つは独立しているので、SDKを入れ直してもconfigurationと認証は残る。

## Homebrew の cask を使わない理由

caskは「Homebrewがバージョンを管理して更新するパッケージ」ではなかった。実際にHomebrewが担うのは
初期配置・virtualenv作成・シンボリックリンクだけで、本体は`gcloud components update`が自己更新する。
Homebrewの台帳と実体が構造的にずれる二重管理であり、Google自身もcaskをcommunity-maintainedと
明記している。

2026-08-07のHomebrew commit `f8fcbd88e0`（Sandbox structured cask operations）が、caskの
preflightとpostflightをサンドボックス実行に変えた。サンドボックスは`HOME`を一時ディレクトリへ
差し替え、`deny_read_home`と`deny_all_network`を課す。gcloud-cliのpostflightは`gcloud config virtualenv`の
delete・create・enableを実行し、virtualenv作成はpipの外部取得を伴うため、この条件では必ず失敗する。
失敗すると`cask/installer.rb`のロールバックがバージョンディレクトリ・メタデータ・binaryの
シンボリックリンクを巻き戻し、`gcloud`がPATHから消える。2026-08-09に実際に発生した。

移行時点では、サンドボックスを無効化する手段が無かった。`HOMEBREW_NO_SANDBOX_CASK`は定義が残るだけで
コードからの参照が消えており、`HOMEBREW_AVOID_NESTED_SANDBOXING`はデフォルトprefixでは拒否された。

virtualenvとPythonパス由来の導入失敗は過去にも繰り返し報告されており、今回だけの一時的な問題とは
言えない。公式archiveへ移せば、故障範囲は`~/.local/share/google-cloud-sdk`に閉じ、Homebrewの
メタデータや他のcaskに波及しなくなる。

## Python について

Apple SiliconではSDK同梱Pythonの実体が無い。`bundled-python3-unix`のmanifestは0件で、
`platform/bundledpythonunix`も存在せず、ランチャーは外部Pythonを要求する。したがって
`python@3.14`はHomebrewで管理し続ける。`awscli`と`pipx`も同じformulaを使う。

Brewfileに直接宣言する。Homebrew 6の`brew bundle install`は、宣言済みformulaの
`installed_on_request`をtrueへ補正する。実装は`bundle/subcommand/install.rb`が呼ぶ
`mark_as_installed_on_request!`である。これにより、依存元の`awscli`や`pipx`を消しても
`brew autoremove`の対象にならない。既存機では移行時に状態を即時補正するため
`brew install python@3.14`を一度実行した。

`CLOUDSDK_PYTHON`は日常の実行では設定しない。gcloudのランチャーは、この変数が未設定のときにだけ
`~/.config/gcloud/virtenv`を有効化する。

## 導入（新マシン）

`chezmoi apply`で自動的に行われる。`run_after_90-gcloud-install.sh`が、導入済みなら即終了し、
未導入なら公式archiveをchecksum検証のうえ展開する。90番なのは、gcloudの導入失敗が
他のbootstrapを止めないよう最後に回すためである。Pythonに依存するので`10-brew-bundle`の後に走る。

手動で行う場合も同じ手順でよい。

```bash
bash ~/other/dotfiles/home/.chezmoiscripts/run_after_90-gcloud-install.sh
```

導入後、プロファイルごとに認証する。

```bash
mise run google:auth <profile>
```

## 更新

`mise run tools:update`の中で`gcloud:upgrade`が`gcloud components update --quiet`を実行する。
単体なら次のとおり。

```bash
mise run gcloud:upgrade   # 更新
mise run gcloud:check     # 状態の表示のみ
```

bootstrapスクリプトに書いてあるバージョンとSHAはseed用なので、毎リリースに追随する必要はない。
実体はcomponent managerが最新へ追随する。ただし対応macOS・対応Python・archiveの提供状況が変わり、
新マシンでseed導入できなくなったときは、バージョンとSHAを一緒に更新してbootstrapを再検証する。

## 壊れたときの復旧

`gcloud components update`の中断などでSDKが壊れた場合、まずcomponent managerでの修復を試す。

```bash
gcloud components reinstall
```

これで直らなければ、SDK rootを退避してbootstrapを再実行する。`~/.config/gcloud`は別ディレクトリなので、
configuration・認証情報・virtenvは維持される。

```bash
mv ~/.local/share/google-cloud-sdk ~/.local/share/google-cloud-sdk.broken
bash ~/other/dotfiles/home/.chezmoiscripts/run_after_90-gcloud-install.sh
```

## 参考

- Google公式のversioned archives — <https://docs.cloud.google.com/sdk/docs/downloads-versioned-archives>
- Google公式のコンポーネント管理 — <https://docs.cloud.google.com/sdk/docs/components>
- Homebrewの該当commit — <https://github.com/Homebrew/brew/commit/f8fcbd88e037084ce18d8db6161d42d921cadf13>
