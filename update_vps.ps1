$ErrorActionPreference = "Continue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "[ANGKOR EYES] ONE-CLICK GIT PUSH & VPS DEPLOY" -ForegroundColor Yellow
Write-Host "Repository: https://github.com/hemsoknitha-sketch/angkor-eyes.git" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

Write-Host "[1/4] Staging changes..." -ForegroundColor Green
git add -A

$status = git status --porcelain
if ($status) {
    Write-Host "[2/4] Committing changes..." -ForegroundColor Green
    git commit -m "chore: unify architecture, archive duplicates, and harden security ($timestamp)"
} else {
    Write-Host "[2/4] Working tree already clean, proceeding to sync..." -ForegroundColor Yellow
}

Write-Host "[3/4] Syncing with remote history (git pull --rebase)..." -ForegroundColor Green
git pull --rebase origin main

Write-Host "[4/4] Pushing to GitHub (origin main)..." -ForegroundColor Green
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Git push failed. Check network or GitHub credentials." -ForegroundColor Red
    exit 1
} else {
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "SUCCESS: Pushed cleanly to GitHub (main)!" -ForegroundColor Green
    Write-Host "VPS Command: cd /opt/angkor-eyes && sudo bash scripts/update_vps.sh" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Cyan
}