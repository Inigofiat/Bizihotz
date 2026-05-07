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

run_node_coverage() {
  local service="$1"
  echo "==> Coverage Node: $service"
  (
    cd "$ROOT_DIR/$service"
    npm run coverage
  )
}

run_python_coverage() {
  local service="$1"
  local py
  py="$(resolve_python "$service")"
  echo "==> Coverage FastAPI/Python: $service"
  (
    cd "$ROOT_DIR/$service"
    "$py" -m pytest --cov=app --cov-report=term-missing --cov-report=html --cov-fail-under=80
  )
}

for service in microservicioGestion microservicioComunicacion microservicioChatbot; do
  run_node_coverage "$service"
done

for service in api-gateway microservicioNutricion microservicioDocumental; do
  run_python_coverage "$service"
done

echo "OK: cobertura completada."
