# Claude Code マルチプロファイル運用

作業ディレクトリに応じて Claude Code の設定・履歴・MCP・プラグイン・認証を
personal / hucom-system / hucom / client の4プロファイルへ切り替える仕組みの運用手順。

## 構成の要点

- プロファイルの宣言は2か所。自分・自社は `home/.chezmoidata/claude-profiles.toml`（公開）、
  取引先は `home/work/`（非公開 client-dotfiles の git submodule）の `.chezmoidata` にある
  `clientProfiles` で、テンプレートが両辞書を連結する。
- 非公開キーを settings.json へ足すオーバーレイ
  （`~/.config/claude/_private/profile-overlays/<profile>.settings.json`）は
  インストーラーが配置時にマージする。現在は未使用で、仕組みだけ残している。
- chezmoi が書き込むのは `~/.config/claude-profile-config/<profile>/` まで。
  実プロファイル（`~/.claude`・`~/.config/claude/<name>`）はランタイム領域であり、
  `mise run claude:install-profiles` だけが構成6項目
  （`settings.json`・`CLAUDE.md`・`rules`・`keybindings.json`・`commands`・`skills`）を差し替える。
- インストーラーは Claude の全終了を検査し、旧構成を
  `~/.config/claude/.migration-backups/` へ退避してから mv で差し替える。
  途中で失敗すると差し替え済みの項目を自動で書き戻す。

## プロファイルの増やし方

1. `home/.chezmoidata/claude-profiles.toml` に `[[claudeProfiles]]` ブロックを1つ足す。
2. `home/dot_config/claude-profile-config/<name>/` に薄いラッパー4本を置く
   （`private_settings.json.tmpl`・`CLAUDE.md`・`symlink_rules.tmpl`・`symlink_keybindings.json.tmpl`）。
3. `chezmoi apply ~/.config/claude-profile-config` で生成し、
   Claude を全終了して `mise run claude:install-profiles` → `mise run claude:sync-links`。
4. 対象ディレクトリの mise か direnv に `CLAUDE_CONFIG_DIR` を注入する。

取引先は1社ごとにプロファイルを増やす（1社目は `client`。増えたら別の中立名を足し、
既存は改名しない）。取引先プロファイルの宣言は手順1の場所ではなく、client-dotfiles の
`.chezmoidata` に `clientProfiles` として書く。公開側には取引先名を書かず、
対象ディレクトリとの対応は非公開側（`_private/CLAUDE-common.md`）で解決する。

## 共通スキルの足し方

- 公開できるスキルは `~/.config/claude/_shared/skills/`（chezmoi 管理）、
  公開できないスキルは `~/.config/claude/_private/skills/`（非公開リポジトリ）に置く。
- 置いたら `mise run claude:sync-links` を実行する。宣言（`excludeSkills`）に従って
  各プロファイルへシンボリックリンクで配られる。

## 切り替えが効かないときの調べ方

```bash
mise x -C <dir> -- sh -c 'echo $CLAUDE_CONFIG_DIR'   # mise の注入を確認
direnv exec <dir> sh -c 'echo $CLAUDE_CONFIG_DIR'    # direnv の注入を確認
CLAUDE_CONFIG_DIR=<dir> claude auth status            # プロファイルの認証を確認
env -u CLAUDE_CONFIG_DIR claude auth status           # personal の認証を確認
```

- personal を扱うコマンドは `env -u CLAUDE_CONFIG_DIR` で環境変数を明示的に外す。
  `~/.claude` を明示指定すると別の状態ファイルを見にいく。
- `claude auth status` は未ログイン時も JSON を出力しつつ終了コード非0で終わる。
  成否判定は終了コードでなく出力の JSON を見る。

## 新マシンでの復元順

1. このリポジトリを clone して chezmoi を初期化する
   （`home/work/` の非公開 submodule も取得されるため GitHub 認証が要る）
2. `~/.config/claude/_private` に非公開共通層リポジトリを clone する
3. 作業リポジトリを clone する
4. 対象を限定して `chezmoi apply` する（`~/.config/claude/_shared`・
   `~/.config/claude-profile-config`・`~/.config/mise`・`~/work/`）。
   実プロファイルは対象にしない
5. `~/.agents/skills` を Skillsfile の復元タスクで先に揃える（`claude:sync-links` の配布元）
6. 公開・非公開スキルの実行時依存を `bun install` で復元する
7. `mise run claude:install-profiles` で構成を実プロファイルへ配置する
   （`_private/profile-overlays/` もここでマージされる）
8. `mise run claude:sync-links` でスキルを配る
9. `mise trust` と `direnv allow` を実行する
10. 取引先ディレクトリの配置物（envrc・mise.toml・settings.local.json）は
    手順4の `chezmoi apply` が submodule 経由で配る。追加の手作業は不要
11. 各プロファイルで `/login` する
12. `mise run claude:restore` を実行する
13. 取引先向け local スコープのプラグインは宣言の外にある。
    入れ直しの手順は `_private/CLAUDE-common.md` を参照する
