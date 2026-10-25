# Claude Code マルチプロファイル運用

作業ディレクトリに応じて Claude Code の設定・履歴・MCP・プラグイン・認証を
既定（自社）/ hucom / client の 3 プロファイルへ切り替える仕組みの運用手順。
2026-10-18 に宣言 toml からの生成層（中間層・専用インストーラー・リンク配布）を撤去し、
chezmoi が素のファイルを実プロファイルへ直接配る形にした。

## 構成の要点

- 既定プロファイル（自社アカウント）は Claude Code 本来の `~/.claude` で、`CLAUDE_CONFIG_DIR` を設定しない。
  GUI や新しいタブから起動しても同じプロファイルになる（2026-10-19 に `~/.config/claude/hucom-system` から移した）。
- 取引先は公式の方式（アカウントごとに `CLAUDE_CONFIG_DIR` を分ける）で、取引先の作業ツリーだけ client-dotfiles が配る
  mise.toml（`~/work/harmo/.mise.toml`・`~/work/hucom/mise.toml`）の `[env]` が `~/.config/claude/<プロファイル>` を指す。
- settings.json は基底 1 つ（`home/.chezmoitemplates/claude/settings.json.tmpl`）に、プロファイルごとの
  差分 JSON を重ねて配る。差分に書くのは plugins・marketplaces・autoMode だけで、共通の permissions・hooks・
  statusLine・sandbox は基底 1 か所の修正で 3 プロファイルに届く。
  - 既定: `home/.chezmoitemplates/claude/default.extra.json`
  - 取引先: client-dotfiles の `<取引先>/.chezmoitemplates/<取引先>/settings-extra.json`
    （取引先名を含む marketplace 名や autoMode の説明文は公開側に書けないため）
  - 描画は `home/.chezmoitemplates/claude/render-settings`。差分は非空の値で基底を上書きし、
    配列は丸ごと置換する。false や空の値では基底を消せない（消したい項目は基底から外す）
  - `/model` で選んだ `model`・`modelSettings` は配備先の値を保つ（chezmoi の modify テンプレート）
- プロファイルごとの実ファイルは既定が `home/private_dot_claude/`、取引先が `home/dot_config/claude/private_<プロファイル>/`
  （`private_` が配備先ディレクトリを 0700 にする）にある
  （`modify_private_settings.json`・`CLAUDE.md`・`rules` と `keybindings.json` の symlink）。
  共通の rules・keybindings・scripts・statusline・自作 skills は `home/dot_config/claude/_shared/`。
- autoMode の `environment`（分類器に渡す信頼先の説明）は User か Managed スコープにしか置けないため、
  リポジトリ固有の内容でも各プロファイルの差分に書く。
- 配備先（`~/.claude` と `~/.config/claude/<プロファイル>` の CLAUDE.md・settings.json・rules・keybindings.json）は直接
  編集しない。settings.json の PreToolUse hook（`_shared/scripts/deny-generated-config-edit.sh`）が拒否する。
- 本体に任せるもの: ログイン（`/login`）、MCP の OAuth（`claude mcp login`）、プラグインのダウンロード、
  履歴・状態（`.claude.json`）。これらは dotfiles に持たない。
- personal は 2026-10-18 に廃止した。旧 `~/.claude` と `~/.claude.json` は `~/.config/claude/personal-retired/` に退避してあり、dotfiles からは触らない。

## 取引先プロファイルの増やし方

1. `home/dot_config/claude/private_<名前>/` に `modify_private_settings.json`（既存をコピーし、差分 JSON のパスを変える）、
   `CLAUDE.md`、`symlink_rules.tmpl`、`symlink_keybindings.json.tmpl` を置く。
2. client-dotfiles に `<取引先>/.chezmoitemplates/<取引先>/settings-extra.json` を置く
   （plugins・marketplaces・autoMode だけ）。
3. 取引先の作業ツリーの mise.toml（client-dotfiles）の `[env]` に `CLAUDE_CONFIG_DIR` を書き、
   `claude:restore` タスクに MCP 登録を書く。direnv の `.envrc` には書かない
   （2026-10-07 に direnv のフックの不具合で、新しいタブで起動した Claude が既定で動いた）。
4. 秘密が要るなら client-dotfiles の `clientSecretsLedger` と `home/dot_config/private_secrets/claude/` の
   env・helper テンプレートを足す。
5. `chezmoi apply` → そのディレクトリで `/login` → `mise run claude:restore`。

公開側には取引先名を書かない。対象ディレクトリとの対応は非公開側（`_private/notes/profile-mapping.md`）で解決する。

## MCP の登録

- 登録は各プロファイルの `claude:restore` タスクが行う（存在保証のみ。名前が一致すれば URL やヘッダの差異は見ない）。
  自社分は `home/dot_config/mise/tasks/claude/executable_restore`、取引先分は各作業ツリーの mise.toml にあり、
  その配下では mise が取引先のタスクを優先する。1 件ずつの登録は `~/.local/libexec/claude-mcp-ensure` が担う。
- `mise run claude:restore -- --check` で、登録せずに不足だけを検査できる。
- API キー型は headersHelper 付きで登録し、値はどこにも書かない。URL 自体が秘密の MCP は
  登録時だけ 0600 の env ファイルから読む。OAuth 型（`claude-mcp-ensure oauth`）はクライアント ID が公開値なので直書きし、
  初回に `claude mcp login <名前>` で認証する。
- 取引先向けの local スコープのプラグインは宣言の外にある。入れ直しの手順は `_private/notes/new-machine.md` を参照する。

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
- `keywrap/gws` だけは鍵ではなく TLS 信頼ストアの差し替え（`SSL_CERT_FILE` を Homebrew の
  Mozilla 由来の束へ向け、eMudhra 侵害中間を拒否する）。上流 gws が rustls-webpki 0.103.16
  以降を同梱したら削除する（2026-10-25）。
- Codex CLI の MCP は `~/.codex/config.toml` の `http_headers_helper` に同じ headersHelper を
  指定して鍵を注入する（keywrap は使わない）。plugin は `mise codex:restore` が導入する。
- `.zshenv` は `CLAUDECODE=1` のシェルで台帳の全変数を unset し、MULTIOS を無効化する（保険層）。
- Claude Code の settings は `~/.config/secrets` の読み取りを deny する。
  `sandbox.credentials.envVars` の一覧は基底テンプレートが台帳から起こす。
  sandbox は **enabled=false で待機**（2026-08-31、運用影響が大きくユーザー判断で
  無効化。構成ブロックは検証済みのまま維持しており、基底の enabled を
  true に戻す1行 + apply で再有効化できる）。無効時の残余は
  「Python 等の任意バイナリ経由の秘密ファイル読み取りを permissions.deny では
  塞げない」1点（0600・env 全廃・利用地点供給は据え置き）。
  無効時は Read()/cat 系 deny がツール自身の設定読込を遮らないため、
  gh hosts.yml・aws の Read() deny は復活させてある（再有効化時は再び撤去が必要）。
- sandbox 構成の根拠（2026-08-30 に `--settings` の1セッション検証で実測）:
  - `network.allowedDomains: ["*"]` — 既定は全ドメイン都度プロンプトで無人運転が
    止まるため全許可。遮断の主目的はファイル（秘密）で、ネットワーク隔離は採らない。
  - `filesystem.allowWrite` — 既定は作業ディレクトリ外の書き込み拒否で gws トークン
    更新や mise の状態書き込みが壊れる。ホーム全域許可は自己改変（settings 配布物・
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
- 検査: `mise claude:secrets-audit` が mise env・新シェル・ファイル権限・helper（raw と
  Bearer）を、値を表示せずに確認する。検査は1か所でなく、各プロファイルの作業ディレクトリ
  （mise コンテキスト）ごとに実行する。**人間の端末で実行すること**: エージェントの
  sandbox 内からは ~/.config/secrets に一切触れないため、ファイル権限と helper の
  3検査が原理的に NG になる（それ自体が遮断の証拠）。
- permissions.allow のルールは sandbox の書き込み許可へ昇格するため、ホーム直下の
  ファイルを指す Edit 許可（旧 `Edit(~/.zshrc)` 等）を書かない（自己改変の穴になる）。
- 供給経路を変えたときは、apply 前から開いていたシェルに旧環境変数が残る。
  全 Claude を終了し、既存ターミナルを再起動してから新シェルで監査する。
- chezmoi は read-source-state の pre hook で `op vault list` を実行するため、
  apply だけでなく diff・execute-template も 1Password の認証待ちで止まる。
  chezmoi コマンドは在席時にだけ実行し、1 回の作業では apply を 1 回にまとめる。
  settings の描画だけを試すときは、フック無しの設定ファイルと別の sourceDir・destDir を
  `--config` で指す（op を呼ばない）。

## 配備の流れ

1. 正本を編集する（基底・差分・CLAUDE.md・`_shared/`）。
2. `chezmoi apply -v` を 1 回実行する。settings.json は実行中の Claude にも再読込される
   （permissions・hooks・env）。`model` など起動時に読むキーだけは再起動が要る。
   apply 前の `chezmoi diff` は、配備先で `/plugin` や `/model` が書いた未回収の変更を見るために使う。
   未回収の変更は黙って消さず、継続するものは正本へ取り込む。
3. MCP を足したときは、そのプロファイルの作業ディレクトリで `mise run claude:restore`。

## 共通スキルの足し方

- 公開できるスキルは `~/.config/claude/_shared/skills/`（chezmoi 管理）、
  公開できないスキルは `~/.config/claude/_private/skills/`（非公開リポジトリ）、
  外部のスキルは `~/.agents/skills/`（Skillsfile から `npx skills` で復元）に置く。
- 各プロファイルの `skills/` ディレクトリはランタイム領域で、スキルごとのシンボリックリンクを持つ。
  新しいスキルは `ln -s <実体> ~/.config/claude/<プロファイル>/skills/<名前>` で使うプロファイルに足す
  （Claude Code はシンボリックリンクのスキルを実体から読む）。

## 切り替えが効かないときの調べ方

```bash
mise x -C <dir> -- sh -c 'echo $CLAUDE_CONFIG_DIR'   # mise の注入を確認
(cd <dir> && zsh -i -c 'echo $CLAUDE_CONFIG_DIR')   # 新しく開いたシェルでの注入を確認（.zshrc を通す）
CLAUDE_CONFIG_DIR=<dir> claude auth status            # 取引先プロファイルの認証を確認（既定は変数なしで実行）
```

- `claude auth status` は未ログイン時も JSON を出力しつつ終了コード非0で終わる。
  成否判定は終了コードでなく出力の JSON を見る。

## 新マシンでの復元順

1. このリポジトリを clone して chezmoi を初期化する
   （`home/work/` の非公開 submodule も取得されるため GitHub 認証が要る）
2. `~/.config/claude/_private` に非公開共通層リポジトリを clone する
3. 作業リポジトリを clone する
4. `chezmoi apply` する（実プロファイルの settings.json・CLAUDE.md・rules・keybindings.json、
   `~/.config/secrets`、`~/.local/libexec`、`~/.config/mise`、`~/work/` の配置物が揃う）。
   `.zshenv.zwc` を使っている場合は削除か再生成をする
5. `~/.agents/skills` を Skillsfile の復元タスクで揃え、公開・非公開スキルの実行時依存を
   `bun install` で復元し、各プロファイルの `skills/` にリンクを張る
6. `mise trust` を実行する
7. 各プロファイルの作業ディレクトリで `/login` し、`mise run claude:restore` を実行する
8. 取引先向け local スコープのプラグインは `_private/notes/new-machine.md` の手順で入れ直す
