#!/usr/bin/env bash
set -euo pipefail

# Sandbox auto-deploys on every push to main.
# This script is a manual fallback for deploying the current local state
# to sandbox without pushing to main (e.g., for quick local testing).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI is required. Install with: npm i -g vercel" >&2
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
echo "Open https://sandbox.growyourcashflow.io to test the sandbox."
