@echo off
echo Starting SK MART POS...
echo.
if not exist node_modules (
    echo Installing dependencies...
    npm install
)
echo Launching Server...
start http://localhost:3000
node server.js
pause
