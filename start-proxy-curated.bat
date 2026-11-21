@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo Starting Boursify Co-Pilot CURATED Proxy on http://127.0.0.1:8787 ...
    node proxy-curated.mjs
    pause
    exit /b 0
)
if exist "C:\Program Files\nodejs\node.exe" (
    echo Starting Boursify Co-Pilot CURATED Proxy on http://127.0.0.1:8787 ...
    "C:\Program Files\nodejs\node.exe" proxy-curated.mjs
    pause
    exit /b 0
)
echo ============================================================================
echo Node.js is not installed on this laptop -- NO PROBLEM!
echo.
echo copilot.js now includes the FULL Curated SBG 2026 Handbook Engine built-in
echo and runs 100%% inside your browser with NO Node.js or proxy needed!
echo.
clip < copilot.js
echo [OK] copilot.js has just been COPIED TO YOUR WINDOWS CLIPBOARD!
echo.
echo Next step (takes 5 seconds):
echo   1. Go to https://play.boursify.io/player/trade in your browser
echo   2. Right-click anywhere -^> Inspect -^> Console
echo   3. Press Ctrl+V and press Enter (then click "Test")
echo ============================================================================
pause
