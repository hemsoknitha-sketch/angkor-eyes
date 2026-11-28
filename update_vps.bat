@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================================
echo 🇰🇭 [ANGKOR EYES] ONE-CLICK AUTO GIT PUSH ^& VPS DEPLOY
echo Repository: https://github.com/hemsoknitha-sketch/angkor-eyes.git
echo GCP Instance: angkor-eyes (us-central1-a, quant-gold-514007)
echo ==========================================================

echo [1/3] Staging all files...
git add -A

echo [2/3] Creating automated commit...
git commit -m "sync: automated update from local station (%date% %time%)"

echo [3/3] Pushing changes to GitHub remote (origin main)...
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo 🔄 Detected divergent remote history. Synchronizing with authoritative push...
    git pull --rebase origin main && git push origin main
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Git push failed. Please check your internet connection or Git credentials.
) else (
    echo.
    echo ==========================================================
    echo ✅ SUCCESS: Pushed to GitHub repository successfully!
    echo ==========================================================
    echo ⚡ If 24/7 Auto-Sync is enabled on your VPS, it will
    echo    automatically pull and restart within 60 seconds!
    echo.
    echo 💡 Otherwise, run this 1-line command on VPS SSH:
    echo    cd /opt/angkor-eyes ^&^& sudo bash scripts/update_vps.sh
    echo ==========================================================
)

echo.
pause
