#!/bin/bash
# hooks.read-source-state.pre から毎回実行される。
# 新マシンでは Homebrew と 1Password を導入し、op 未認証なら明確に中断する。
# 秘密テンプレートはソースステート読み込み時に評価されるため、このフックが唯一の割り込み点。
set -eu

export PATH="/opt/homebrew/bin:$PATH"

if ! command -v brew >/dev/null 2>&1; then
  echo "[ensure-prereqs] Homebrew をインストールします..." >&2
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if ! command -v op >/dev/null 2>&1; then
  echo "[ensure-prereqs] 1Password (app + CLI) をインストールします..." >&2
  brew install --cask 1password 1password-cli
fi

# 認証検査: アプリ連携時に op whoami が偽陰性を返す報告があるため、実際の読み取りで判定する。
# 1回目の失敗で即断しない。アプリ連携ではシステム認証のタイミング差で一時的に失敗することがある
# （2026-08-09 に chezmoi 経由で複数回再現し、op を直接叩くと成功した）。
# 2回目は stderr を捨てず、op の実際のエラーをそのまま見せる。すべての失敗を「未認証」に丸めると、
# 再発したときに原因を切り分けられない。
if ! op vault list >/dev/null 2>&1; then
  sleep 1
  if ! op vault list >/dev/null; then
    echo "[ensure-prereqs] 1Password CLI の読み取り検査に失敗しました（直前の行に op の出力があります）。" >&2
    echo "  未認証の場合は、1Password アプリにサインインし、設定 > 開発者 > 'Integrate with 1Password CLI' を有効化してから再実行してください。" >&2
    exit 1
  fi
fi
