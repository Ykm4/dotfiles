#!/bin/bash
# Google Cloud CLI を公式の versioned archive から導入する。
#
# Homebrew の cask を使わない理由: cask は初期配置と virtualenv 作成とリンクだけを担い、本体は
# gcloud components update が自己更新するという二重管理になっている。2026-08-07 に Homebrew が
# cask の postflight をサンドボックス実行（HOME 差し替え・ネットワーク遮断）へ変えた結果、
# gcloud-cli の virtualenv 作成が必ず失敗し、ロールバックで Caskroom のメタデータと binary の
# シンボリックリンクが巻き戻された。Google 自身も Homebrew cask を community-maintained と明記している。
#
# ここでは seed 導入だけを行う。以後の更新は mise の gcloud:upgrade（gcloud components update）が担うため、
# このスクリプトのバージョンは古くなってよい。
#
# run_onchange ではなく run_after にしているのは、新マシンで毎回「導入済みか」を確かめるためである。
# 導入済みなら数ミリ秒で終わる。90 番なのは、gcloud の導入失敗が mise など他の bootstrap を止めないよう
# 最後に回すため。Python は Brewfile の python@3.14 に依存するので、10-brew-bundle の後である必要がある。
set -euo pipefail

sdk_root="${XDG_DATA_HOME:-$HOME/.local/share}/google-cloud-sdk"
[ -x "$sdk_root/bin/gcloud" ] && exit 0

# -L も見るのは、リンク切れのシンボリックリンクだと -e が偽になるためである。
# 見逃すと 62MB のダウンロードと展開を終えたあと、最後の mv が ENOTDIR で落ちる。
if [ -e "$sdk_root" ] || [ -L "$sdk_root" ]; then
  echo "[gcloud-install] 不完全な SDK がある: $sdk_root" >&2
  echo "  中身を確認し、退避または削除してから再実行すること。" >&2
  exit 1
fi

# brew が無い環境では、この eval が空文字列になって set -e をすり抜け、
# 後段の python3.14 のエラーに化けて真因が隠れる。先に存在を確かめる。
if [ ! -x /opt/homebrew/bin/brew ]; then
  echo "[gcloud-install] Homebrew が無い。先に chezmoi の 10-brew-bundle を完了すること。" >&2
  exit 1
fi
eval "$(/opt/homebrew/bin/brew shellenv)"

# Apple Silicon では SDK 同梱 Python の実体が無い（bundled-python3-unix の manifest は 0 件で
# platform/bundledpythonunix も存在しない）。ランチャーは外部 Python を要求するため必須。
python="$(command -v python3.14 || true)"
if [ -z "$python" ]; then
  echo "[gcloud-install] python3.14 が無い。先に brew bundle を完了すること。" >&2
  exit 1
fi

version="579.0.0"
archive="google-cloud-cli-${version}-darwin-arm.tar.gz"
sha256="c43232ba6cedfea699ead175273e6018b411390ed028a5e3346d858a76acf7d4"
url="https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/${archive}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl --fail --location --proto '=https' --tlsv1.2 "$url" --output "$tmp/$archive"
printf '%s  %s\n' "$sha256" "$tmp/$archive" | shasum -a 256 -c -

tar -xzf "$tmp/$archive" -C "$tmp"

# PATH と補完は .zshenv と .zshrc が持つので install.sh には触らせない。
CLOUDSDK_PYTHON="$python" \
  "$tmp/google-cloud-sdk/install.sh" \
    --quiet \
    --usage-reporting=false \
    --path-update=false \
    --command-completion=false \
    --install-python=false

mkdir -p "$(dirname "$sdk_root")"
mv "$tmp/google-cloud-sdk" "$sdk_root"

echo "[gcloud-install] 導入した: $sdk_root" >&2
echo "  認証は mise run google:auth <profile> で行う。" >&2
