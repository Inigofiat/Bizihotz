#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ACTION="${1:-up}"
TARGET="${2:-}"

case "$ACTION" in
  up)
    docker compose up -d --build
    ;;
  down)
    docker compose down
    ;;
  restart)
    docker compose down
    docker compose up -d --build
    ;;
  ps)
    docker compose ps
    ;;
  logs)
    if [[ -n "$TARGET" ]]; then
      docker compose logs -f "$TARGET"
    else
      docker compose logs -f
    fi
    ;;
  *)
    echo "Uso: ./scripts/run-stack.sh [up|down|restart|ps|logs] [servicio]"
    exit 1
    ;;
esac
