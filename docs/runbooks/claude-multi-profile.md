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
- インストーラーは全体実行では Claude の全終了を検査し、旧構成を
  `~/.config/claude/.migration-backups/` へ退避してから mv で差し替える。
  途中で失敗すると差し替え済みの項目を自動で書き戻す。
- `mise run claude:install-profiles -- <名前>` でプロファイルを絞り込める。
  絞り込み時は全終了の代わりに、対象配下を開いているプロセスが無いことを検査する
  （explicitEnv=false のプロファイルは全体実行でのみ差し替える）。

## プロファイルの増やし方

1. `home/.chezmoidata/claude-profiles.toml` に `[[claudeProfiles]]` ブロックを1つ足す。
2. `home/dot_config/claude-profile-config/<name>/` に薄いラッパー4本を置く
   （`private_settings.json.tmpl`・`CLAUDE.md`・`symlink_rules.tmpl`・`symlink_keybindings.json.tmpl`）。
3. `chezmoi apply ~/.config/claude-profile-config` で生成し、
   `mise run claude:install-profiles -- <名前>` → `mise run claude:sync-links`。
   新設プロファイルだけなら Claude を終了せずに配置できる。
4. 対象ディレクトリの mise か direnv に `CLAUDE_CONFIG_DIR` を注入する。

取引先は1社ごとにプロファイルを増やす（1社目は `client`。増えたら別の中立名を足し、
既存は改名しない）。取引先プロファイルの宣言は手順1の場所ではなく、client-dotfiles の
`.chezmoidata` に `clientProfiles` として書く。公開側には取引先名を書かず、
対象ディレクトリとの対応は非公開側（`_private/notes/profile-mapping.md`）で解決する。

## シークレットの供給（API キー等）

秘密はシェル環境に常在させない（2026-08 の API キー露出インシデント対応で再設計）。

- 正本は秘密台帳。自分・自社は `home/.chezmoidata/secrets-ledger.toml`（公開）、
  取引先は client-dotfiles の `.chezmoidata` にある `clientSecretsLedger` で、
  テンプレートが両辞書を連結する。
- chezmoi apply が 1Password から値を読み、`~/.config/secrets/claude/<profile>.env`
  （0600・生の KEY=VALUE）を生成する。op が動くのは apply のときだけで、実行時には呼ばない。
- MCP は headersHelper（`~/.config/secrets/claude/helpers/<profile>-<service>.sh`）が
  接続の瞬間に env ファイルからヘッダを生成する。環境変数にも MCP 設定にも値を置かない。
- 鍵が要る CLI は `~/.local/libexec/keywrap/` のラッパー経由で実行の瞬間だけ読む
  （mise グローバル `[env] _.path` がツールパスより前に置く）。
- `.zshenv` は `CLAUDECODE=1` のシェルで台帳の全変数を unset し、MULTIOS を無効化する（保険層）。
- Claude Code の settings は `~/.config/secrets` の読み取りを deny し、
  sandbox（OS 強制・enabled=true）で秘密ファイルを Bash とその全子プロセスから遮断する。
- sandbox 構成の根拠（2026-08-30 に `--settings` の1セッション検証で実測）:
  - `network.allowedDomains: ["*"]` — 既定は全ドメイン都度プロンプトで無人運転が
    止まるため全許可。遮断の主目的はファイル（秘密）で、ネットワーク隔離は採らない。
  - `filesystem.allowWrite` — 既定は作業ディレクトリ外の書き込み拒否で gws トークン
    更新や mise の状態書き込みが壊れる。ホーム全域許可は自己改変（settings 生成物・
    keywrap・shell rc の汚染、~/.config/secrets の上書き）を許すため採らず、実際の
    書き込み先だけを列挙する（Codex レビュー指摘）。不足は即失敗で見えるので都度追記。
  - `allowUnixSockets`（1Password の agent.sock 1本のみ）— unix ソケットは既定
    ブロックで、コミット署名（gpg.format=ssh・op-ssh-sign）が使う 1Password
    エージェントが塞がれ署名が失敗するため。gnupg は未使用のため許可しない。
    docker(colima) も未許可で、エージェントからの docker は sandbox 下では動かない。
    注意: ソケット許可はエージェント配下の Bash に SSH 署名・認証の要求能力を残す
    （sandbox 導入前と同等。1Password 側でキーを絞る強化は将来課題）。
  - `enableWeakerNetworkIsolation: true` — Go 製 CLI（gh・gws・gcloud）は sandbox の
    ネットワークプロキシの証明書を信頼せず TLS 検証に失敗するため（実測）。
    **配置は `sandbox` 直下**（`network` 内に書くと黙って無視される。実測で確定）。
  - gh は動かす判断のため `Read(~/.config/gh/hosts.yml)` と `Read(~/.aws/**)` の deny は
    撤去したまま（aws は client 案件の CLI 動作を優先）。gnupg・kube・docker の Read()
    deny は復活済み（対応する CLI をエージェントから使う必要が出たら再検討）。
    `gh auth token` はトークンを直接出力するため deny を追加。
    `git credential fill` 等の資格情報オラクルは sandbox 導入前と同等の残余リスク。
  - `allowUnsandboxedCommands: false` — 違反時の昇格再実行を禁止し、無人時は
    即失敗で可視化する。
  - 注意: `permissions.deny` の `Read()` ルールは sandbox 有効時に OS 強制へ昇格し、
    CLI 自身の設定読み込みまで遮断する（実測）。gh・gnupg・aws・kube・docker の
    `Read()` deny はこの理由で base から撤去した（cat/grep 系 deny は残置）。
    ツールが自分の設定を読めず壊れたら、まず deny リストとの衝突を疑う。
  - 注意: `credentials.files` の `mode` は deny か mask のみ。無効な値を書くと
    保護層全体が黙って無効化される（実測）。変更時は必ず sentinel 検査で確認する。
  - sandbox 下ではエージェントからの firecrawl CLI と video:summarize は鍵を
    読めない（設計どおり。エージェントは firecrawl MCP を使い、CLI は人間用）。
- 鍵のローテーション: 1Password の値を更新 → `chezmoi apply`。MCP の再登録は不要
  （headersHelper が次の接続で新しい値を読む）。
- 検査: `mise run claude:secrets-audit` が mise env・新シェル・ファイル権限・helper（raw と
  Bearer）を、値を表示せずに確認する。検査は1か所でなく、各プロファイルの作業ディレクトリ
  （mise コンテキスト）ごとに実行する。
- 供給経路を変えたときは、apply 前から開いていたシェルに旧環境変数が残る。
  全 Claude を終了し、既存ターミナルを再起動してから新シェルで監査する。
- chezmoi は read-source-state の pre hook で `op vault list` を実行するため、
  apply だけでなく diff・execute-template も 1Password の認証待ちで止まる。
  chezmoi コマンドは在席時にだけ実行する。

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
   `~/.config/claude-profile-config`・`~/.config/mise`・`~/.config/secrets`・
   `~/.local/libexec`・`~/.zshenv`・`~/work/`）。
   実プロファイルは対象にしない。`.zshenv.zwc` を使っている場合は削除か再生成をする。
   注意: 対象指定 apply は一覧に無い親ディレクトリを作らない。新設の深い対象は
   親ディレクトリ（例: `~/.local/libexec`）を対象にするか、先に `mkdir -p` する
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
    入れ直しの手順は `_private/notes/new-machine.md` を参照する
