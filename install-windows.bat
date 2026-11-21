@echo off
REM ANGKOR EYES - Windows one-click installer
REM Double-click this file. It runs scripts\install-windows.ps1.
REM Project folder must be E:\ANGKOR EYES
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-windows.ps1"
echo.
pause
