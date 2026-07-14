#!/bin/bash
# ユーザースコープの MCP サーバーを冪等に登録する。
# user スコープ MCP の保存先は ~/.claude.json（状態ファイル）でファイル管理できないため、
# このスクリプトが宣言の代わりになる。API キーは Claude Code 実行時に環境変数から展開される
# （mise の secrets.toml が CONTEXT7_API_KEY を供給。値はここに書かない）。
set -eu
command -v claude >/dev/null 2>&1 || { echo "[claude-mcp] claude CLI 未導入のためスキップ"; exit 0; }

if ! claude mcp get context7 >/dev/null 2>&1; then
  claude mcp add --scope user --transport http context7 https://mcp.context7.com/mcp \
    --header 'CONTEXT7_API_KEY: ${CONTEXT7_API_KEY}'
  echo "[claude-mcp] context7 を user スコープに登録した"
fi
