@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo   Structural Toolbox for Raycast Windows
echo   Structures / Formula Reference / Materials and Sections
echo ============================================================
echo.
echo Close the previous Structural Toolbox development terminal,
echo if it is still running. Keep Raycast open.
echo.

if not exist "package.json" (
  echo Keep Install.cmd inside the complete structural-toolbox folder.
  goto failed
)

where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js LTS from https://nodejs.org and run this again.
  goto failed
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js npm is missing. Reinstall Node.js LTS, then try again.
  goto failed
)
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]*1000000+v[1]*1000+v[2]>=22022002?0:1)"
if errorlevel 1 (
  echo Please update Node.js to the current LTS release first.
  echo This extension requires Node.js 22.22.2 or newer.
  goto failed
)

echo [1/5] Installing the exact required packages, including equation rendering.
call npm.cmd ci --no-audit --no-fund
if errorlevel 1 goto failed

echo.
echo [2/5] Checking the extension...
call npm.cmd run typecheck
if errorlevel 1 goto failed

echo.
echo [3/5] Checking the calculation engine...
call npm.cmd test
if errorlevel 1 goto failed

echo.
echo [4/5] Building all commands...
call npm.cmd run build
if errorlevel 1 goto failed

if /i "%~1"=="--check" (
  echo.
  echo Installer checks passed. Raycast was not launched.
  exit /b 0
)

echo.
echo [5/5] Loading the extension into Raycast...
echo.
echo Wait for the build to finish, then search Raycast for Structures.
echo Open Structures and type simply, 6m, 3kN/m, C24, 100x300.
echo Keep this window open during the first test.
echo.
echo This uses the release Raycast folder rather than raycast-x,
echo correcting the Missing executable error from the previous setup.
echo.
call npm.cmd run dev
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo Setup stopped at the failed step above.
echo Copy the error text and send it to Codex for repair.
echo Your material presets and saved calculations were not removed.
if /i not "%~1"=="--check" pause
exit /b 1
