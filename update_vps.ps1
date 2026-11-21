# ==========================================================
# 🇰🇭 [ANGKOR EYES] AUTO GIT COMMIT, PUSH & VPS UPDATE
# Repository: https://github.com/hemsoknitha-sketch/angkor-eyes.git
# GCP Instance: angkor-eyes (us-central1-a, quant-gold-514007)
# ==========================================================

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🇰🇭 [ANGKOR EYES] AUTO GIT COMMIT, PUSH & VPS DEPLOY" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Git Add & Commit
Write-Host "📌 [1/3] Staging changes..." -ForegroundColor Green
git add -A

Write-Host "📝 [2/3] Committing changes..." -ForegroundColor Green
git commit -m "sync: automated platform update $timestamp"

# 2. Git Push
Write-Host "🚀 [3/3] Pushing to GitHub (origin main)..." -ForegroundColor Green
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Git push requires authentication or network access." -ForegroundColor Red
} else {
    Write-Host "✅ Pushed to GitHub repository successfully!" -ForegroundColor Green
}

# 3. Check for gcloud SSH direct execution
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🌐 GOOGLE CLOUD VPS UPDATE TRIGGER" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

if (Get-Command gcloud -ErrorAction SilentlyContinue) {
    Write-Host "⚡ Triggering remote update via gcloud SSH..." -ForegroundColor Cyan
    gcloud compute ssh angkor-eyes --zone=us-central1-a --project=quant-gold-514007 --command="sudo bash /opt/angkor-eyes/scripts/update_vps.sh"
} else {
    Write-Host "💡 Open the Google Cloud Console Web SSH:" -ForegroundColor White
    Write-Host "👉 https://console.cloud.google.com/compute/instancesDetail/zones/us-central1-a/instances/angkor-eyes?project=quant-gold-514007" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📋 Paste this 1-line command to deploy/update instantly:" -ForegroundColor White
    Write-Host "curl -sSL https://raw.githubusercontent.com/hemsoknitha-sketch/angkor-eyes/main/scripts/update_vps.sh | sudo bash" -ForegroundColor Green
}
Write-Host "==========================================================" -ForegroundColor Cyan
