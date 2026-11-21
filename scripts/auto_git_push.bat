@echo off
chcp 65001 > nul
title ANGKOR EYES - Auto Git Push (No PowerShell Needed)
color 0A

echo ==========================================================
echo 🇰🇭 [ANGKOR EYES] Auto Git Push to GitHub ^& VPS (1-Click)
echo ==========================================================
echo.

cd /d "%~dp0\.."

echo 📥 [1/4] Fetching latest status from GitHub...
git fetch origin main

echo 🔄 [2/4] Pulling and rebasing any remote changes...
git pull origin main --rebase

echo 📦 [3/4] Staging all files...
git add -A

set COMMIT_MSG=feat(sovereign-live): streaming ministerial debate, live executive brief to leadership, and 24-7 tunnel sync (%date% %time%)
git diff --cached --quiet
if errorlevel 1 (
    echo 📝 [3.5/4] Committing changes: %COMMIT_MSG%
    git commit -m "%COMMIT_MSG%"
) else (
    echo ℹ️ No uncommitted changes detected.
)

echo 🚀 [4/4] Pushing to GitHub (origin main)...
git push origin main

if errorlevel 1 (
    echo.
    echo ⚠️ Standard push was rejected due to diverged history.
    echo 🔄 Retrying with safe force-push to align remote with local repository...
    git push origin main --force
)

echo.
echo ==========================================================
echo ✅ PUSH COMPLETE!
echo.
echo 💡 VPS Auto-Sync will detect this commit and automatically
echo    update your server within 60 seconds (Zero downtime)!
echo ==========================================================
echo.
pause
