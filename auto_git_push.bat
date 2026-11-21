@echo off
chcp 65001 > nul
title ANGKOR EYES - Auto Git Push
color 0A

echo ==========================================================
echo 🇰🇭 [ANGKOR EYES] Pushing to GitHub...
echo ==========================================================
echo.

cd /d "E:\AI CODE PYTHON\ANGKOR EYES"

echo 📦 [1/2] Checking files...
git add -A
git commit -m "feat(auto-debate): live 24/7 streaming debate and executive brief (%date% %time%)"

echo.
echo 🚀 [2/2] Force-pushing latest code to GitHub (origin main)...
git push origin main --force

echo.
echo ==========================================================
echo ✅ PUSH COMPLETE TO GITHUB!
echo.
echo 💡 Now go to VPS and run:
echo    cd /opt/angkor-eyes ^&^& sudo bash scripts/update_vps.sh
echo ==========================================================
echo.
pause
