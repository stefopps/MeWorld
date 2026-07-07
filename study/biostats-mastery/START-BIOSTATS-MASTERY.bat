@echo off
setlocal EnableExtensions
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo === Biostats Mastery ===
echo   http://localhost:8090
echo   Questions tab -^> Pivot mode
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python not found. Install Python or open index.html via a local server.
  pause
  exit /b 1
)

start "" "http://localhost:8090"
python -m http.server 8090
