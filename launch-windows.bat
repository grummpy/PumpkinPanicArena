@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>&1
if %errorlevel%==0 (
  py -3 server.py
  if errorlevel 1 pause
  exit /b %errorlevel%
)

where python >nul 2>&1
if %errorlevel%==0 (
  python server.py
  if errorlevel 1 pause
  exit /b %errorlevel%
)

where python3 >nul 2>&1
if %errorlevel%==0 (
  python3 server.py
  if errorlevel 1 pause
  exit /b %errorlevel%
)

echo Python 3 is required to launch Pumpkin Panic Arena.
echo Install it from https://www.python.org/downloads/ and try again.
pause
exit /b 1
