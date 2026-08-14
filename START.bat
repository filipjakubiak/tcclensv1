@echo off
cd /d "%~dp0"
start "" http://localhost:4192
node tools\serve.mjs 4192
