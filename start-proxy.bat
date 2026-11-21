@echo off
cd /d "%~dp0"
echo Starting Boursify AI Co-Pilot Local Proxy on http://127.0.0.1:8787 ...
node proxy.mjs
pause
