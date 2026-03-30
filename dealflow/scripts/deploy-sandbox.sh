#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI is required to deploy the sandbox." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Refusing to deploy from a dirty worktree. Commit, stash, or discard local changes first." >&2
  exit 1
fi

echo "Building locally before sandbox deploy..."
npm run build

echo
echo "Deploying the current clean state to the Vercel sandbox environment..."
vercel deploy --target=sandbox --yes

echo
echo "Current sandbox deployment:"
vercel inspect sandbox.growyourcashflow.io

echo
echo "Open https://sandbox.growyourcashflow.io to test the sandbox."
echo "If Vercel Authentication is enabled for non-production deployments, open the share link from the sandbox deployment page once to set the access cookie in your browser."
