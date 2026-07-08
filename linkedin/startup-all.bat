@echo off
:: ── MeWorld + Postiz — Boot-time launcher ──
:: Runs when Windows starts. Launches both the content poster (arc-viz)
:: and the social scheduler (Postiz) in the background.

echo === MeWorld Boot ===

:: 0. Start the arc-viz auto-save state server (port 9801)
start "" /MIN node "C:\dev\Schedular\state-server.js"
echo    state server launched

:: 1. Start the arc-viz HTTP server (minimized, port 8080)
start "" /MIN python -m http.server 8080
timeout /t 2 /nobreak >nul
start "" http://localhost:8080/arc-viz.html
echo    arc-viz launched

:: 2. Start Postiz (Docker + backend + frontend + orchestrator)
::    launch-postiz.ps1 -NoBrowser is idempotent and safe to run repeatedly
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\dev\Schedular\launch-postiz.ps1" -NoBrowser
echo    Postiz launched

echo === MeWorld Boot complete ===
