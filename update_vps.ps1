# ==========================================================
# 🇰🇭 [ANGKOR EYES] AUTO GIT COMMIT, PUSH & VPS DEPLOY
# Repository: https://github.com/hemsoknitha-sketch/angkor-eyes.git
# GCP Instance: angkor-eyes (us-central1-a, quant-gold-514007)
# ==========================================================

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🇰🇭 [ANGKOR EYES] ONE-CLICK GIT PUSH & VPS DEPLOY" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Git Add & Commit
Write-Host "📌 [1/3] Staging changes..." -ForegroundColor Green
git add -A

Write-Host "📝 [2/3] Committing changes..." -ForegroundColor Green
git commit -m "sync: automated platform update $timestamp"

# 2. Git Push with Divergence Handling
Write-Host "🚀 [3/3] Pushing to GitHub (origin main)..." -ForegroundColor Green
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "🔄 Divergent history detected. Synchronizing with authoritative push..." -ForegroundColor Yellow
    git push origin main --force
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git push failed. Please check your network or GitHub credentials." -ForegroundColor Red
} else {
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "✅ SUCCESS: Pushed to GitHub repository successfully!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "⚡ If 24/7 Auto-Sync is enabled on your VPS, it will" -ForegroundColor White
    Write-Host "   automatically pull and restart within 60 seconds!" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Otherwise, run this 1-line command on VPS SSH:" -ForegroundColor Yellow
    Write-Host "   cd /opt/angkor-eyes && sudo bash scripts/update_vps.sh" -ForegroundColor White
    Write-Host "==========================================================" -ForegroundColor Cyan
}
