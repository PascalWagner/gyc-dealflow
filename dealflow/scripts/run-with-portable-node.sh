#!/usr/bin/env bash
# Wrapper: runs a command with the local node from PATH.
# Usage: ./scripts/run-with-portable-node.sh npm run check:canonical-db-shape
set -euo pipefail
exec "$@"
