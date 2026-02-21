@echo off
setlocal
echo Starting SK MART POS...
echo.

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your system PATH.
    echo Please install Node.js from https://nodejs.org/
    echo Once installed, restart your computer and try again.
    echo.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist node_modules (
    echo node_modules not found. Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies. Please check your internet connection.
        pause
        exit /b 1
    )
)

echo Launching Server...
start http://localhost:3000
node server.js
pause
