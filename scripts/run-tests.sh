#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

resolve_python() {
  local service="$1"
  if [[ -x "$ROOT_DIR/$service/.venv/Scripts/python.exe" ]]; then
    echo "$ROOT_DIR/$service/.venv/Scripts/python.exe"
    return
  fi
  if [[ -x "$ROOT_DIR/$service/.venv/bin/python" ]]; then
    echo "$ROOT_DIR/$service/.venv/bin/python"
    return
  fi
  echo "python"
}

run_node_tests() {
  local service="$1"
  echo "==> Tests Node: $service"
  (
    cd "$ROOT_DIR/$service"
    npm test
  )
}

run_python_tests() {
  local service="$1"
  local py
  py="$(resolve_python "$service")"
  echo "==> Tests FastAPI/Python: $service"
  (
    cd "$ROOT_DIR/$service"
    "$py" -m pytest -q
  )
}

for service in microservicioGestion microservicioComunicacion microservicioChatbot; do
  run_node_tests "$service"
done

for service in api-gateway microservicioNutricion microservicioDocumental; do
  run_python_tests "$service"
done

if [[ "${1:-}" == "--e2e" ]]; then
  echo "==> Tests E2E Docker Compose"
  RUN_COMPOSE_E2E=1 python -m pytest -m e2e tests/e2e/test_compose_stack.py -q
fi

echo "OK: tests completados."
