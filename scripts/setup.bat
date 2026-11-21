@echo off
echo ========================================================
echo   🇰🇭 ANGKOR EYES - AGI AGENTS PLATFORM SETUP
echo ========================================================
echo.

echo [1/3] Installing Backend Dependencies...
cd backend
call npm install
cd ..

echo.
echo [2/3] Installing Local Runner Dependencies...
cd local-runner
call npm install
cd ..

echo.
echo [3/3] Installing Telegram Mini Web Dependencies...
cd web
call npm install
cd ..

echo.
echo ========================================================
echo   ✅ ALL DEPENDENCIES INSTALLED SUCCESSFULLY!
echo ========================================================
echo.
echo To start ANGKOR EYES Orchestrator Backend:
echo   cd backend ^&^& npm run dev
echo.
echo To start Local Runner Daemon:
echo   cd local-runner ^&^& npm run dev
echo.
echo To start Telegram Mini Web UI:
echo   cd web ^&^& npm run dev
echo.
pause
