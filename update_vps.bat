@echo off
chcp 65001 >nul
echo ==========================================================
echo 🇰🇭 [ANGKOR EYES] AUTO GIT COMMIT, PUSH ^& VPS UPDATE
echo Repository: https://github.com/hemsoknitha-sketch/angkor-eyes.git
echo GCP Instance: angkor-eyes (us-central1-a, quant-gold-514007)
echo ==========================================================

echo [1/3] Staging all files...
git add -A

echo [2/3] Creating automated commit...
git commit -m "sync: automated update from local station (%date% %time%)"

echo [3/3] Pushing changes to GitHub remote...
git push origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️ Git push encountered an issue. If credentials are required, please authenticate with GitHub.
) else (
    echo.
    echo ✅ Git push completed successfully!
)

echo.
echo ==========================================================
echo 🚀 TO UPDATE GOOGLE CLOUD VPS INSTANCE:
echo ==========================================================
echo 1. Open Google Cloud Web SSH:
echo    https://console.cloud.google.com/compute/instancesDetail/zones/us-central1-a/instances/angkor-eyes?project=quant-gold-514007
echo.
echo 2. Paste and run this one-line command:
echo    curl -sSL https://raw.githubusercontent.com/hemsoknitha-sketch/angkor-eyes/main/scripts/update_vps.sh ^| sudo bash
echo ==========================================================
pause
