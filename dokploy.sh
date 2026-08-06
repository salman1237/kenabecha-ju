#!/bin/sh
# Thin wrapper around the Dokploy API.
#
# Reads the key from .dokploy.key rather than taking it as an argument, so the
# secret never appears in a command line, a process list, or shell history.
#
#   ./dokploy.sh /project.all
#   ./dokploy.sh /compose.one '?composeId=xxx'
set -e
KEY_FILE="$(dirname "$0")/.dokploy.key"
[ -f "$KEY_FILE" ] || { echo "missing $KEY_FILE" >&2; exit 1; }
KEY=$(tr -d '\r\n' < "$KEY_FILE")
curl -sS -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  "https://dokploy.deshlet.com/api${1}${2:-}"
