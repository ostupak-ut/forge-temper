@echo off
REM ============================================================
REM  FORGE launcher  -  double-click to run the app
REM  (no VSCode needed; uses your local claude / codex CLIs)
REM ============================================================
title FORGE launcher
cd /d "%~dp0"

REM --- require Node.js ---
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js was not found on PATH.
  echo     Install it from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

REM --- install dependencies on first run ---
if not exist "node_modules\" (
  echo Installing dependencies ^(first run only, may take a minute^)...
  call npm install
  if errorlevel 1 (
    echo [X] npm install failed. See the messages above.
    pause
    exit /b 1
  )
)

REM --- if it's already running, just open the browser ---
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo FORGE already running -- opening browser...
  start "" "http://localhost:5173"
  timeout /t 2 /nobreak >nul
  exit /b 0
)

REM --- start Vite + the API together, in their own window ---
echo Starting FORGE ^(web on 5173, API on 8787^)...
start "FORGE (servers - close to stop)" cmd /k "npm run dev"

REM --- give them a moment, then open the browser ---
echo Waiting for the app to come up...
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo   FORGE is running in the other window.
echo   App:  http://localhost:5173
echo   Stop: close the "FORGE (servers ...)" window.
echo.
echo   (This launcher window will close automatically.)
timeout /t 4 /nobreak >nul
exit /b 0
