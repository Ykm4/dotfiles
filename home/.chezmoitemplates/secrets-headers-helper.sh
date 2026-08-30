{{- /*
  Claude Code の MCP headersHelper を秘密台帳から生成する共通テンプレート。
  呼び出し側: {{ includeTemplate "secrets-headers-helper.sh" (dict "profile" "<プロファイル>" "service" "<サービス>" "root" .) }}
  台帳: secretsLedger（公開側）+ clientSecretsLedger（client-dotfiles）を連結して読む。
  契約: Claude Code が MCP 接続・再接続時に実行し、stdout の JSON（ヘッダ名→値）を使う。
  秘密は ~/.config/secrets/claude/<プロファイル>.env（生の KEY=VALUE・0600）から行単位で読む。
  値を stdout の JSON 以外（stderr 含む）へ出さない。失敗時は値を含まない診断で非0終了（fail-closed）。
*/ -}}
{{- $client := dict -}}
{{- if hasKey .root "clientSecretsLedger" }}{{ $client = .root.clientSecretsLedger }}{{ end -}}
{{- $ledger := merge (dict) .root.secretsLedger $client -}}
{{- $entry := index (index $ledger .profile) .service -}}
{{- $h := $entry.header -}}
{{- /* 台帳のレンダリング時検証: scheme は "" か "Bearer " のみ、header.var は vars に存在すること */ -}}
{{- if and (ne $h.scheme "") (ne $h.scheme "Bearer ") }}{{ fail (printf "secrets-ledger: %s.%s の scheme が不正" .profile .service) }}{{ end -}}
{{- $varFound := false -}}
{{- range $entry.vars }}{{ if eq .name $h.var }}{{ $varFound = true }}{{ end }}{{ end -}}
{{- if not $varFound }}{{ fail (printf "secrets-ledger: %s.%s の header.var が vars に無い" .profile .service) }}{{ end -}}
{{- $mode := "raw" -}}
{{- if eq $h.scheme "Bearer " }}{{ $mode = "bearer" }}{{ end -}}
#!/bin/sh
# 生成物: 編集しない。正本は dotfiles の .chezmoitemplates/secrets-headers-helper.sh と秘密台帳。
# プロファイル: {{ .profile }} / サービス: {{ .service }}

umask 077

secret_file_default='{{ .root.chezmoi.homeDir }}/.config/secrets/claude/{{ .profile }}.env'
var_name='{{ $h.var }}'
header_name='{{ $h.name }}'
value_mode='{{ $mode }}'
jq_bin='{{ lookPath "jq" | default "/opt/homebrew/bin/jq" }}'

fail() {
    printf '%s\n' "headers-helper: $1" >&2
    exit 1
}

# --test-file は sentinel 検査（claude:secrets-audit）専用。
case "$#" in
    0)
        secret_file=$secret_file_default
        ;;
    2)
        [ "$1" = "--test-file" ] ||
            fail "invalid arguments"
        secret_file=$2
        ;;
    *)
        fail "invalid arguments"
        ;;
esac

case "$var_name" in
    ''|[0-9]*|*[!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_]*)
        fail "invalid variable name"
        ;;
esac

[ -n "$header_name" ] ||
    fail "header name is empty"

case "$jq_bin" in
    /*) ;;
    *) fail "jq path is not absolute" ;;
esac

[ -x "$jq_bin" ] ||
    fail "jq is unavailable"

[ -f "$secret_file" ] ||
    fail "secret file is unavailable"

[ ! -L "$secret_file" ] ||
    fail "secret file must not be a symbolic link"

file_mode=$(/usr/bin/stat -f '%Lp' "$secret_file" 2>/dev/null) ||
    fail "cannot inspect secret file"

[ "$file_mode" = "600" ] ||
    fail "secret file permissions must be 0600"

found=0
secret_value=

while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
        '')
            continue
            ;;
        \#*)
            continue
            ;;
        *=*)
            key=${line%%=*}
            value=${line#*=}
            ;;
        *)
            fail "secret file contains an invalid record"
            ;;
    esac

    [ "$key" = "$var_name" ] ||
        continue

    found=$((found + 1))
    [ "$found" -eq 1 ] ||
        fail "variable is defined more than once"

    secret_value=$value
done < "$secret_file"

[ "$found" -eq 1 ] ||
    fail "variable is not defined"

[ -n "$secret_value" ] ||
    fail "variable is empty"

carriage_return=$(printf '\r')
case "$secret_value" in
    *"$carriage_return"*)
        fail "variable contains an invalid control character"
        ;;
esac

case "$value_mode" in
    bearer)
        header_value="Bearer $secret_value"
        ;;
    raw)
        header_value=$secret_value
        ;;
    *)
        fail "invalid header value mode"
        ;;
esac

# 秘密を jq の argv に載せず stdin で渡す（ps からの覗き見を避ける）。
if ! json=$(
    printf '%s' "$header_value" |
        "$jq_bin" -Rsc --arg name "$header_name" '{($name): .}'
); then
    fail "JSON encoding failed"
fi

printf '%s\n' "$json"
unset secret_value header_value json value line
exit 0
