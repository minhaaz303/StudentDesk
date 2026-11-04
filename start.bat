@echo off
setlocal
cd /d "%~dp0"
if exist "C:\Program Files\nodejs\npm.cmd" set "PATH=C:\Program Files\nodejs;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js, then reopen this file.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with the npm package manager option enabled.
  pause
  exit /b 1
)

if not exist .env (
  for /f "delims=" %%i in ('node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"') do set "JWT_SECRET=%%i"
  > .env echo PORT=3000
  >> .env echo MONGODB_URI=mongodb://127.0.0.1:27017/studentdesk
  >> .env echo JWT_SECRET=%JWT_SECRET%
  echo Created a private .env configuration file. Replace MONGODB_URI with your Atlas connection string, save, and close Notepad.
  start "" /wait notepad ".env"
)

findstr /B "MONGODB_URI=" .env | findstr /C:"PASTE_" >nul
if not errorlevel 1 (
  echo Replace the PASTE_ placeholder in MONGODB_URI with your Atlas database password, save, and close Notepad.
  start "" /wait notepad ".env"
)

if not exist node_modules (
  echo Installing StudentDesk dependencies...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo Starting StudentDesk at http://localhost:3000
call npm start
pause
