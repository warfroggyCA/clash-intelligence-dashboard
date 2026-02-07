#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_WEB_NEXT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_WEB_NEXT"

# Ensure only one Next dev (port 5050).
if nc -z 127.0.0.1 5050 2>/dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Next dev already listening on :5050; exiting wrapper."
  exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Next dev on :5050"
exec npm run dev
