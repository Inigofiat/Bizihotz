param(
    [ValidateSet("up", "down", "restart", "ps", "logs")]
    [string]$Cmd = "up",
    [string]$Service = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

switch ($Cmd) {
    "up" {
        docker compose up -d --build
    }
    "down" {
        docker compose down
    }
    "restart" {
        docker compose down
        docker compose up -d --build
    }
    "ps" {
        docker compose ps
    }
    "logs" {
        if ([string]::IsNullOrWhiteSpace($Service)) {
            docker compose logs -f
        }
        else {
            docker compose logs -f $Service
        }
    }
}
