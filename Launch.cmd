@echo off
rem Double-click to start Disk Treemap. Installs dependencies on first run.
cd /d "%~dp0"

if not exist "node_modules\electron\dist\electron.exe" (
  where npm >nul 2>nul || (
    echo Node.js is required. Install it from https://nodejs.org and try again.
    pause
    exit /b 1
  )
  echo First run: installing dependencies, this takes a minute...
  call npm install --no-fund --no-audit || (
    echo Install failed.
    pause
    exit /b 1
  )
)

start "" "node_modules\electron\dist\electron.exe" "%~dp0."
