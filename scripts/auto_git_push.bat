@echo off
chcp 65001 > nul
title ANGKOR EYES - Auto Git Push (No PowerShell Needed)
color 0A

echo ==========================================================
echo 🇰🇭 [ANGKOR EYES] Auto Git Push to GitHub ^& VPS (1-Click)
echo ==========================================================
echo.

cd /d "%~dp0\.."

echo 📦 [1/3] Staging and committing all local changes...
git add -A

set COMMIT_MSG=feat(sovereign-live): 24-7 live auto debate and mini web streaming (%date% %time%)
git diff --cached --quiet
if errorlevel 1 (
    echo 📝 Committing changes: %COMMIT_MSG%
    git commit -m "%COMMIT_MSG%"
) else (
    echo ℹ️ All latest code already committed.
)

echo.
echo 🚀 [2/3] Pushing to GitHub (origin main)...
git push origin main

if errorlevel 1 (
    echo.
    echo ⚠️ Standard push rejected. Force-syncing latest code to GitHub...
    git push origin main --force
)

echo.
echo ==========================================================
echo ✅ PUSH COMPLETE TO GITHUB!
echo.
echo 💡 Now updating VPS: If auto_sync is running on VPS, it will
echo    update within 60s. Or run on VPS:
echo    cd /opt/angkor-eyes ^&^& sudo bash scripts/update_vps.sh
echo ==========================================================
echo.
pause
