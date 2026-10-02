@echo off
cd /d "%~dp0"
node scripts\launch-local-retest.mjs
if errorlevel 1 pause
