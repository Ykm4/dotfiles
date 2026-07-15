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
- 1Password SSHエージェントの鍵許可リスト（`1Password/ssh/agent.toml`）— エージェントに載せる鍵をここで明示的に絞る。
- ghostty・starship・mise・dutiの各設定
- Finicky設定（`~/.finicky.js`）— リンクをURLパターンごとにブラウザ・プロファイルへ振り分ける（既定はArc、Claude関連はChromeの個人プロファイル）
- gcloudのconfigurationファイル（`hucom-system`・`personal`の2プロファイル。account・projectの値は1Passwordから注入）
- Google Workspace APIのclient secretテンプレート（`hucom-system`・`personal`の2プロファイル分。値は1Passwordから注入）
- miseのsecrets（`~/.config/mise/conf.d/secrets.toml`。APIキーと取引先envパスの値は1Passwordから注入）
- Claude Codeのユーザー設定（`~/.claude`のsettings.json・keybindings・statusline・rules・scripts・公開可能なskills。settings.jsonの`enabledPlugins`がプラグインの宣言、user スコープMCPは`run_onchange`スクリプトで登録）

## 管理対象外・復元手順

新マシンでの`chezmoi apply`完了後、次を手動で行う。

- `gh auth login`・プロファイルごとの`gws auth login`・`gcloud auth login`を再実行する。
- `~/.zshrc.local`・`~/.ssh/config.local`を旧マシンから手動で移送する（chezmoi管理外のローカル拡張）。
- 取引先スコープの設定は、1Passwordの取引先用Vaultから`op read`で手動復元する。
- Claude Codeの非公開設定（`CLAUDE.md`・`settings.json`・一部skills）をprivateリポジトリから復元する: `cd ~/.claude && git init -b master && git remote add origin git@github.com:Ykm4/claude-global-config.git && git fetch origin && git checkout master`
- シンボリックリンク型のskills（`~/.agents/skills/`参照）は`skills` CLI（mise管理の`npm:skills`）で再インストールし、依存を持つskillは各ディレクトリで`bun install`する（現状はskill-lintのみ）。
- Claude Codeのプラグインはmarketplaceから再インストールする。
- Finickyを一度起動し、macOSの既定ブラウザに設定する（OSの確認ダイアログで承認する。ブラウザの振り分けルールは`~/.finicky.js`が担う）。

## 1Password の Vault/item 構成（値は非掲載）

chezmoiのテンプレートが参照するのは`dotfiles` Vaultのみである。

- `dotfiles` Vault
  - item `identity` — gcloudのaccount・project（`hucom-system`・`personal`の各プロファイル分）
  - item `mise-secrets` — miseのsecrets.tomlに注入する値（APIキー・取引先envパス）
  - item `gws-client-secret` — Google Workspace APIのclient secret（`hucom-system`・`personal`の各プロファイル分）
  - item `git-signing` — コミット署名用SSH鍵（1PasswordのSSHエージェント経由でのみ使用し、秘密鍵はディスクに書き出さない）
- そのほかのVault（個人用・自社用・取引先ごとのVault）は本リポジトリのテンプレートからは参照しない。
