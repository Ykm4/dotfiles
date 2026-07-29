# dotfiles

macOS開発環境の設定を[chezmoi](https://www.chezmoi.io/)で管理する。
秘密は1Passwordから`chezmoi apply`時に注入し、リポジトリには値を置かない。

## Bootstrap（新マシン）

```bash
xcode-select --install                                       # [0] git (CLT)
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --source "$HOME/other/dotfiles" --apply Ykm4   # [1] chezmoi 導入 + 初回適用
# 初回は1Password未サインインのため`[ensure-prereqs]`のエラーで意図的に中断する。[2]のサインイン後に再実行すれば適用される。
# [2] 1Password アプリにサインインし、設定 > 開発者 > CLI 連携を有効化
chezmoi apply                                                # [3] 再適用で完了
```

適用後の手動ステップは「管理対象外・復元手順」を参照する。

## Layout

- `.chezmoiroot` — source rootは`home/`
- ソースリポジトリの実体は`~/other/dotfiles`（`sourceDir`設定で明示）
- `scripts/ensure-prereqs.sh` — `hooks.read-source-state.pre`から毎回実行（Homebrew/1Passwordの導入と認証検査）
- `home/.chezmoiscripts/` — `run_onchange`スクリプト（brew bundle/mise install/duti）

## 管理対象

- Homebrew（`~/.Brewfile`）— formula・cask一式（1Passwordアプリ・CLIを含む）。手宣言で管理し`brew bundle dump`は使わない（乖離確認は`mise r brewfile:audit`）
- zsh設定（`.zshrc`/`.zprofile`/`.zshenv`）
- git設定（`.gitconfig`・`git/allowed_signers`・`git/ignore`）— コミット署名は1PasswordのSSHエージェント経由
- gh（GitHub CLI）設定（`gh/private_config.yml`）
- SSHクライアント設定（`.ssh/config`）— `IdentityAgent`を1PasswordのSSHエージェントに固定
- 1Password SSHエージェントの鍵許可リスト（`1Password/ssh/agent.toml`）— エージェントに載せる鍵をここで明示的に絞る。取引先の鍵はitem名・vault名が識別子にあたるため1Passwordから注入。
- 取引先踏み台向けSSH設定（`.ssh/config.local`）と公開鍵（`.ssh/partner-*.pub`）— 値は1Passwordから注入。秘密鍵はSSH Keyアイテムとしてエージェントが保持し、ディスクには置かない。`IdentityFile`には公開鍵を指定し`IdentitiesOnly yes`を維持する（外すとエージェント上の全鍵を順に提示するため`MaxAuthTries`に達し、無関係な鍵をサーバへ送ることになる）。既存鍵の取り込みは`op`では行えず1Passwordアプリからインポートする。
- ghostty・starship・mise・duti・bat・direnvの各設定
- Finicky設定（`~/.finicky.js`）— リンクを対応表に従いブラウザ・プロファイルへ振り分け、Slack/Zoom/Teamsはdeep linkでアプリ起動（既定はArc）。取引先の識別子（プロファイル名・ドメイン・GCPプロジェクト）は1Passwordから注入。検証は`mise r finicky:verify`（dry-runでブラウザを開かずに全経路を確認する）。
- cmux設定（`~/.config/cmux/cmux.json`）— ターミナル内`open`の横取りを無効化しFinicky経由に統一。変更後は`cmux reload-config`で反映
- lazygit設定（`~/.config/lazygit/config.yml`）— macOSの既定パスは`~/Library/Application Support`のため`.zshenv`の`LG_CONFIG_FILE`でXDGパスを参照させる
- Codex CLI設定の雛形（`~/.codex/config.toml`）— `create_`方式で初回のみ生成。以後はCodex自身がtrust情報等を追記するため管理外で育てる（取引先パス・取引先MCPは雛形に含めない）
- gcloudのconfigurationファイル（`hucom-system`・`personal`の2プロファイル。account・projectの値は1Passwordから注入）
- Google Workspace APIのclient secretテンプレート（`hucom-system`・`personal`の2プロファイル分。値は1Passwordから注入）
- miseのsecrets（`~/.config/mise/conf.d/secrets.toml`。APIキーと取引先envパスの値は1Passwordから注入）
- Claude Codeのユーザー設定（`~/.claude`のsettings.json・keybindings・statusline・rules・scripts・公開可能なskills）。settings.jsonの`enabledPlugins`がプラグインの宣言、userスコープMCPは`run_onchange`スクリプトで登録する。

## 管理対象外・復元手順

新マシンでの`chezmoi apply`完了後、次を手動で行う。

- `gh auth login`・プロファイルごとの`gws auth login`・`gcloud auth login`を再実行する。
- `~/.zshrc.local`を旧マシンから手動で移送する（chezmoi管理外のローカル拡張）。
- 取引先スコープの設定は、1Passwordの取引先用Vaultから`op read`で手動復元する。
- Claude Codeの非公開設定（`CLAUDE.md`・`settings.json`・一部skills）をprivateリポジトリから復元する。

  ```bash
  cd ~/.claude && git init -b master && git remote add origin git@github.com:Ykm4/claude-global-config.git && git fetch origin && git checkout master
  ```

- シンボリックリンク型のskills（`~/.agents/skills/`参照）は`skills` CLI（mise管理の`npm:skills`）で再インストールする。依存を持つskillは各ディレクトリで`bun install`する（現状はskill-lintのみ）。
- Claude Codeのプラグインはmarketplaceから再インストールする。
- Claude Code CLI本体をネイティブインストーラで導入する: `curl -fsSL https://claude.ai/install.sh | bash`（Brewfile管理外。導入後は自己アップデート）。
- Claude Desktop（アプリ本体はBrewfileのcask）は`claude_desktop_config.json`に宣言的設定を置かない方針とし、MCPは拡張とコネクタに一本化する。復元は次の2つを手動で行う。
  - 設定 > エクステンションからFilesystem・Chrome control・Context7を再インストールし、Filesystemの許可ディレクトリを最小限で再設定する。
  - 設定 > コネクタで1Password等を再接続する。ChatとCowork用のスキル・プラグイン・コネクタはclaude.aiアカウント同期のため、サインインすれば復元される。
- Finickyを一度起動し、macOSの既定ブラウザに設定する（OSの確認ダイアログで承認する。ブラウザの振り分けルールは`~/.finicky.js`が担う）。
- colimaのVMを初回起動時にリソース指定で作成する: `colima start --cpu 6 --memory 6 --disk 100`（既定値のままVMを作った場合は`colima delete`後に再作成する）。

## 1Password の Vault/item 構成（値は非掲載）

chezmoiのテンプレートが参照するのは`dotfiles` Vaultのみである。

- `dotfiles` Vault
  - item `identity` — gcloudのaccount・project（`hucom-system`・`personal`の各プロファイル分）、Finicky用の取引先識別子、取引先踏み台のSSH設定。Finicky用は`finicky-profile/domain/gcp-project-partner-*`、Slack導入時は`finicky-slack-subdomain/team-partner-*`も必須。SSH用は`ssh-vault-partner-*`・`ssh-item-partner-*-{dev,stg}`・`ssh-pubkey-partner-*-{dev,stg}`・`ssh-config-partner-*`の4系統
  - item `mise-secrets` — miseのsecrets.tomlに注入する値（APIキー・取引先envパス）
  - item `gws-client-secret` — Google Workspace APIのclient secret（`hucom-system`・`personal`の各プロファイル分）
  - item `git-signing` — コミット署名用SSH鍵（1PasswordのSSHエージェント経由でのみ使用し、秘密鍵はディスクに書き出さない）
- そのほかのVault（個人用・自社用・取引先ごとのVault）は本リポジトリのテンプレートからは参照しない。
