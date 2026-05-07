param(
    [switch]$E2E
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

function Get-PythonExe {
    param([string]$Service)

    $venvWindows = Join-Path $RepoRoot "$Service/.venv/Scripts/python.exe"
    $venvUnix = Join-Path $RepoRoot "$Service/.venv/bin/python"

    if (Test-Path $venvWindows) { return $venvWindows }
    if (Test-Path $venvUnix) { return $venvUnix }
    return "python"
}

function Run-NodeTests {
    param([string]$Service)

    Write-Host "==> Tests Node: $Service"
    Push-Location (Join-Path $RepoRoot $Service)
    try {
        npm test
    }
    finally {
        Pop-Location
    }
}

function Run-PythonTests {
    param([string]$Service)

    $pythonExe = Get-PythonExe -Service $Service
    Write-Host "==> Tests FastAPI/Python: $Service"
    Push-Location (Join-Path $RepoRoot $Service)
    try {
        & $pythonExe -m pytest -q
    }
    finally {
        Pop-Location
    }
}

@(
    "microservicioGestion",
    "microservicioComunicacion",
    "microservicioChatbot"
) | ForEach-Object { Run-NodeTests -Service $_ }

@(
    "api-gateway",
    "microservicioNutricion",
    "microservicioDocumental"
) | ForEach-Object { Run-PythonTests -Service $_ }

if ($E2E) {
    Write-Host "==> Tests E2E Docker Compose"
    $env:RUN_COMPOSE_E2E = "1"
    python -m pytest -m e2e tests/e2e/test_compose_stack.py -q
}

Write-Host "OK: tests completados."
