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

# 認証検査: アプリ連携時に op whoami が偽陰性を返す報告があるため、実際の読み取りで判定する
if ! op vault list >/dev/null 2>&1; then
  echo "[ensure-prereqs] 1Password CLI が認証されていません。" >&2
  echo "  1Password アプリにサインインし、設定 > 開発者 > 'Integrate with 1Password CLI' を有効化してから再実行してください。" >&2
  exit 1
fi
