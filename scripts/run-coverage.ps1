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

function Run-NodeCoverage {
    param([string]$Service)

    Write-Host "==> Coverage Node: $Service"
    Push-Location (Join-Path $RepoRoot $Service)
    try {
        npm run coverage
    }
    finally {
        Pop-Location
    }
}

function Run-PythonCoverage {
    param([string]$Service)

    $pythonExe = Get-PythonExe -Service $Service
    Write-Host "==> Coverage FastAPI/Python: $Service"
    Push-Location (Join-Path $RepoRoot $Service)
    try {
        & $pythonExe -m pytest --cov=app --cov-report=term-missing --cov-report=html --cov-fail-under=80
    }
    finally {
        Pop-Location
    }
}

@(
    "microservicioGestion",
    "microservicioComunicacion",
    "microservicioChatbot"
) | ForEach-Object { Run-NodeCoverage -Service $_ }

@(
    "api-gateway",
    "microservicioNutricion",
    "microservicioDocumental"
) | ForEach-Object { Run-PythonCoverage -Service $_ }

Write-Host "OK: cobertura completada."
