@echo off
node "%~dp0accept-main.mjs"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
