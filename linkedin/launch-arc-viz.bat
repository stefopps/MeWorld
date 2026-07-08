@echo off
:: MeWorld Content Poster — Auto-launch
:: Starts local server and opens arc-viz.html in browser

start "" /MIN python -m http.server 8080

:: Wait a beat for the server to spin up
timeout /t 2 /nobreak >nul

start "" http://localhost:8080/arc-viz.html
