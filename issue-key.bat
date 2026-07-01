@echo off
REM ============================================================
REM  FORGE  -  Issue a machine-locked license key for a tester
REM  Double-click this file. It asks for the tester's name and
REM  their Machine ID, then copies a ready-to-send key to your
REM  clipboard. Requires .secrets\ed25519-private.pem (yours).
REM ============================================================
setlocal
title FORGE - Issue a tester license
cd /d "%~dp0"

echo ============================================================
echo    FORGE  -  Issue a license key
echo ============================================================
echo.

REM --- need Node ---
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js not found on PATH. Install from https://nodejs.org
  echo.
  pause
  exit /b 1
)

REM --- need the private signing key ---
if not exist ".secrets\ed25519-private.pem" (
  echo [X] Missing .secrets\ed25519-private.pem
  echo     This is your private signing key - without it you cannot issue keys.
  echo.
  pause
  exit /b 1
)

set "TESTER="
set /p "TESTER=Tester name (e.g. Alice): "
if "%TESTER%"=="" set "TESTER=tester"

echo.
echo Paste the tester's Machine ID (from their Activation screen).
echo (right-click to paste in this window)
set "MACHINE="
set /p "MACHINE=Machine ID: "

if "%MACHINE%"=="" (
  echo.
  echo [X] No Machine ID entered. A machine-locked key needs it.
  echo     Ask the tester for the ID shown on their Activation screen.
  echo.
  pause
  exit /b 1
)

set "DAYS="
set /p "DAYS=Days valid [30]: "
if "%DAYS%"=="" set "DAYS=30"

echo.
echo Issuing a machine-locked key for "%TESTER%" (%DAYS% days)...
echo.

node scripts\issue-license.mjs --tester "%TESTER%" --machine "%MACHINE%" --days %DAYS% --out "%TEMP%\forge-key.txt"
if errorlevel 1 (
  echo.
  echo [X] Could not issue the key - see the error above.
  echo.
  pause
  exit /b 1
)

REM --- copy the key to the clipboard ---
clip < "%TEMP%\forge-key.txt"

echo ------------------------------------------------------------
echo   KEY (already COPIED to your clipboard - just paste it):
echo ------------------------------------------------------------
echo.
type "%TEMP%\forge-key.txt"
echo.
echo.
echo   ^> Send this key to %TESTER%. It ONLY works on their machine
echo   ^> and expires in %DAYS% days.
echo.
del "%TEMP%\forge-key.txt" >nul 2>nul
pause
endlocal
