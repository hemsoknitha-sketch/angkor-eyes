# ANGKOR EYES - install-windows.ps1
# Windows installer for E:\ANGKOR EYES
# Run: double-click install-windows.bat in E:\ANGKOR EYES
# Or in PowerShell (Admin): powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
# Safe to re-run. Pure ASCII, CRLF, UTF-8 with BOM - do not add non-ASCII characters.
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
Write-Host "==> ANGKOR EYES - Windows install" -ForegroundColor Cyan
Write-Host "    Folder: $Root"

function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }
function Info($msg) { Write-Host "==> $msg" -ForegroundColor Green }

# 1. Prerequisite checks
Info "Checking prerequisites..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js is not installed (need 20+). Download: https://nodejs.org/ (LTS)" }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Fail "npm is not installed." }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail "git is not installed. Download: https://git-scm.com/download/win" }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Fail "Docker is not installed. Install Docker Desktop for Windows first: https://www.docker.com/products/docker-desktop/ - enable WSL 2, then restart your PC." }
docker compose version | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "Docker Compose v2 is not available. Start Docker Desktop and wait until it says Engine running." }

$nodeMajor = (node -p "process.versions.node.split(\".\")[0]")
if ([int]$nodeMajor -lt 20) { Fail "Node.js 20+ is required." }
Info "Node $(node -v), npm $(npm -v), git $(git --version), docker $(docker --version)"

# Docker engine must actually be running
docker info | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "Docker Desktop is installed but not running. Open Docker Desktop, wait for Engine running, then run this again." }

# 2. Env file
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Info "Created .env from .env.example - EDIT IT before going further:"
        Info "  TELEGRAM_BOT_TOKEN, ALLOWED_TELEGRAM_IDS, and one LLM key are required."
        Info "  Open E:\ANGKOR EYES\.env in Notepad. NEVER paste tokens in chat."
    } else { Fail ".env.example is missing; cannot create .env." }
} else { Info ".env already exists." }

# Warn on missing required values (do not fail - first-time setup should be visible)
$envContent = Get-Content ".env" -Raw
$missing = @()
if ($envContent -notmatch "(?m)^TELEGRAM_BOT_TOKEN=.+") { $missing += "TELEGRAM_BOT_TOKEN" }
if ($envContent -notmatch "(?m)^ALLOWED_TELEGRAM_IDS=.+") { $missing += "ALLOWED_TELEGRAM_IDS" }
if ($missing.Count -gt 0) {
    Write-Host "WARNING: these are empty in .env and the bot will not work until set: $($missing -join ", ")" -ForegroundColor Yellow
}

# 3. Install workspace dependencies
Info "Installing dependencies..."
foreach ($dir in @("backend", "bot", "frontend", "runner", "tests")) {
    if (Test-Path "$dir\package.json") {
        Info "  npm install -- $dir"
        Push-Location $dir
        npm install --no-audit --no-fund
        Pop-Location
    } else { Info "  (skip $dir - no package.json)" }
}

# 4. Start the stack (core only; runner is added later with --profile runner)
Info "Starting the stack (docker compose up -d --build)..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Fail "docker compose up failed. See the error above." }

Start-Sleep -Seconds 5
docker compose ps

Info "Done. Logs: docker compose logs -f backend bot"
Info "Check health: open http://localhost:3000/health in your browser"
Info "Talk to your bot in Telegram, then open Mini Web from its menu."
Info "Stop: docker compose down | Restart: docker compose up -d"
