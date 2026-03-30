#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI is required to promote the sandbox deployment." >&2
  exit 1
fi

DEPLOYMENT_URL="${1:-}"

if [[ -z "$DEPLOYMENT_URL" ]]; then
  cat >&2 <<'EOF'
Usage:
  npm run promote:sandbox -- <deployment-url>

Example:
  npm run promote:sandbox -- https://dealflow-abc123-pascal-wagners-projects.vercel.app
EOF
  exit 1
fi

echo "Inspecting deployment before promotion..."
vercel inspect "$DEPLOYMENT_URL"

echo
echo "Promoting the tested sandbox deployment to production..."
vercel promote "$DEPLOYMENT_URL" --yes

echo
echo "Production domain:"
echo "  https://dealflow.growyourcashflow.io"
