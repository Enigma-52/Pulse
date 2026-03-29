#!/usr/bin/env bash
set -euo pipefail

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo "  ██████╗ ██╗   ██╗██╗     ███████╗███████╗"
echo "  ██╔══██╗██║   ██║██║     ██╔════╝██╔════╝"
echo "  ██████╔╝██║   ██║██║     ███████╗█████╗  "
echo "  ██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝  "
echo "  ██║     ╚██████╔╝███████╗███████║███████╗"
echo "  ╚═╝      ╚═════╝ ╚══════╝╚══════╝╚══════╝"
echo ""
echo "  Pulse Observability — Installing..."
echo ""

# ── Prereq: docker ────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "ERROR: 'docker' is not installed or not in PATH."
  echo "       Install Docker Desktop: https://docs.docker.com/get-docker/"
  exit 1
fi

# ── Prereq: docker compose (v2 plugin) ───────────────────────────────────────
if ! docker compose version &>/dev/null; then
  echo "ERROR: 'docker compose' (v2 plugin) is not available."
  echo "       Update Docker Desktop or install the Compose plugin:"
  echo "       https://docs.docker.com/compose/install/"
  exit 1
fi

echo "  Docker:         $(docker --version)"
echo "  Docker Compose: $(docker compose version)"
echo ""

# ── Start the stack ───────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "  Starting Pulse stack (this may take a few minutes on first run)..."
echo ""

docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d --build

# ── Wait for UI ───────────────────────────────────────────────────────────────
echo ""
echo "  Waiting for Pulse UI to be ready..."

UI_URL="http://localhost:3301"
MAX_WAIT=60
ELAPSED=0

until curl -sf "$UI_URL" >/dev/null 2>&1; do
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo ""
    echo "  WARNING: UI did not respond within ${MAX_WAIT}s."
    echo "  The stack may still be starting. Check logs with:"
    echo "    docker compose -f $SCRIPT_DIR/docker-compose.yml logs -f"
    exit 0
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done

# ── Success ───────────────────────────────────────────────────────────────────
echo ""
echo "  ✓ Pulse is running"
echo ""
echo "  UI:           http://localhost:3301"
echo "  Ingest API:   http://localhost:8081/v1/ingest"
echo "  Query API:    http://localhost:8082/traces"
echo ""
echo "  To stop:  docker compose -f $SCRIPT_DIR/docker-compose.yml down"
echo "  Logs:     docker compose -f $SCRIPT_DIR/docker-compose.yml logs -f"
echo ""
