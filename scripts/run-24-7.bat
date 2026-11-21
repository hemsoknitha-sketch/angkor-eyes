@echo off
TITLE ANGKOR EYES - 24/7 365 Autonomous AGI Supervisor
echo ==============================================================
echo    ANGKOR EYES - AUTONOMOUS 24/7 365 FREE AGI PLATFORM
echo ==============================================================
echo Starting ANGKOR EYES Orchestrator & Telegram Bot Engine...

:loop
echo [%date% %time%] Launching ANGKOR EYES Engine...
npm start

echo [%date% %time%] Process stopped or crashed. Auto-restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
