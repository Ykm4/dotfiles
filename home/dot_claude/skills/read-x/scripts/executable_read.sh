#!/usr/bin/env bash
# read-x: ログイン状態を読み込んで X の URL を開き、本文テキストを抽出して印字する。
# 使い方: read.sh <url>
# 認証状態: $X_AUTH_STATE があればそれ、なければ ~/.config/x/x-auth.json
#
# 特別な出力 / 終了コード:
#   exit 2  引数なし
#   exit 3  NOT_LOGGED_IN   認証状態ファイルが無い
#   exit 4  SESSION_EXPIRED ログイン画面へリダイレクトされた（期限切れ）
#   exit 5  EXTRACT_FAILED  本文セレクタに当たらなかった
#   exit 6  BROWSER_ERROR   ブラウザ/daemon が応答しない（タイムアウト等）
set -uo pipefail

AUTH="${X_AUTH_STATE:-$HOME/.config/x/x-auth.json}"
URL="${1:-}"
AB_TIMEOUT="${AB_TIMEOUT:-45}"   # agent-browser 1コマンドあたりの上限秒数

if [ -z "$URL" ]; then
  echo "ERROR: URL を指定してください（read.sh <url>）。" >&2
  exit 2
fi
if [ ! -f "$AUTH" ]; then
  echo "NOT_LOGGED_IN"
  exit 3
fi

# 全 agent-browser 呼び出しにタイムアウトを掛ける。
# 古い daemon が固まっていると eval 等が永遠に返らないことがある（実証済み）。
# perl の alarm は exec 後も生きるので、portable な timeout として使える。
ab() { perl -e 'alarm shift; exec @ARGV' "$AB_TIMEOUT" agent-browser "$@"; }
ab_quick() { perl -e 'alarm shift; exec @ARGV' 8 agent-browser "$@"; }

die_browser() {
  echo "BROWSER_ERROR"
  pkill -f agent-browser-darwin 2>/dev/null || true
  exit 6
}

# --- 前処理: 固まった daemon の検出と排除 ---
# 応答確認の軽いコマンドが 8 秒で返らない（>=128 はシグナル死＝ハング）なら
# daemon を殺してクリーンに作り直す。通常のエラー終了（<128）は問題ない。
ab_quick tab >/dev/null 2>&1
rc=$?
if [ "$rc" -ge 128 ]; then
  pkill -f agent-browser-darwin 2>/dev/null || true
  sleep 1
fi

# --- ログイン状態で対象 URL を開く ---
ab --state "$AUTH" open "$URL" >/dev/null 2>&1
ab wait --load networkidle >/dev/null 2>&1 || true

# 開けたか確認。URL が取れない＝ブラウザ異常として即時失敗する。
CUR="$(ab get url 2>/dev/null || echo "")"
[ -z "$CUR" ] && die_browser

# 期限切れ検知: ログイン/フロー系 URL に飛ばされていないか
case "$CUR" in
  *"/i/flow/login"*|*"/login"*|*"/i/jf/"*|*"/account/access"*|*"/?logout"*)
    echo "SESSION_EXPIRED"
    ab close >/dev/null 2>&1 || true
    exit 4
    ;;
esac

# --- ステータス URL なら、記事(Articles)カードがあれば記事ページへ辿る ---
case "$URL" in
  *"/i/article/"*) : ;;  # すでに記事ページ
  *)
    ARTICLE_HREF="$(ab eval --stdin 2>/dev/null <<'JS' || true
const a = document.querySelector('a[href*="/i/article/"]');
a ? a.href : '';
JS
)"
    ARTICLE_HREF="$(printf '%s' "$ARTICLE_HREF" | tr -d '"' | tr -d '\r' | tr -d '\n' | sed 's/[[:space:]]//g')"
    case "$ARTICLE_HREF" in
      http*"/i/article/"*)
        ab --state "$AUTH" open "$ARTICLE_HREF" >/dev/null 2>&1
        ab wait --load networkidle >/dev/null 2>&1 || true
        ;;
    esac
    ;;
esac

# --- 本文抽出: 候補ブロックの中で最も長い innerText を採用する ---
# X の DOM は変わりうるので、特定セレクタ依存を避けて「一番中身のある塊」を拾う方針。
BODY="$(ab eval --stdin 2>/dev/null <<'JS' || true
const cands = [
  ...document.querySelectorAll('[data-testid="tweetText"]'),
  ...document.querySelectorAll('article'),
  document.querySelector('[role="article"]'),
  document.querySelector('main'),
].filter(Boolean);
let best = '';
for (const el of cands) {
  const t = (el.innerText || '').trim();
  if (t.length > best.length) best = t;
}
best;
JS
)"

ab close >/dev/null 2>&1 || true

# eval の戻りは JSON エンコードされた文字列（\n 等がエスケープ済み）。jq でデコードする。
DECODED="$(printf '%s' "$BODY" | jq -r '.' 2>/dev/null)"
if [ -n "$DECODED" ]; then
  BODY="$DECODED"
else
  # JSON でなければ前後のダブルクオートだけ剥がすフォールバック
  BODY="$(printf '%s' "$BODY" | sed -e 's/^"//' -e 's/"$//')"
fi

if [ -z "$BODY" ]; then
  echo "EXTRACT_FAILED"
  exit 5
fi

printf '%s\n' "$BODY"
