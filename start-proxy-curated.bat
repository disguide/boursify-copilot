@echo off
cd /d "%~dp0"
echo Starting Boursify Co-Pilot CURATED Proxy (No API Key Needed) on http://127.0.0.1:8787 ...
node proxy-curated.mjs
pause
