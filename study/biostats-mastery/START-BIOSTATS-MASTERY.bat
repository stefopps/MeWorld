@echo off
setlocal EnableExtensions
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo === Biostats Mastery ===
echo.

REM ── Step 1: Validate question bank before serving ──
where node >nul 2>&1
if errorlevel 1 (
  echo [WARN] Node.js not found — skipping question bank validation
) else (
  echo [VALIDATE] Checking stats_questions.json...
  node scripts\validate_question_bank.mjs
  if errorlevel 1 (
    echo.
    echo [WARN] Validation found issues — review output above before editing data.
    echo         Server will still start, but fix these before committing.
    echo.
  ) else (
    echo [OK] All checks passed.
  )
)

REM ── Step 2: Start the server ──
where python >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python not found. Install Python or open index.html via a local server.
  pause
  exit /b 1
)

echo.
echo   Open: http://localhost:8090
echo         Questions tab -^> Pivot mode
echo.

start "" "http://localhost:8090"
python -m http.server 8090
