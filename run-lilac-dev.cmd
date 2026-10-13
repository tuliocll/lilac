@echo off
rem Teste temporario do Claude: roda o Lilac em modo dev (pode apagar)
cd /d "%~dp0apps\menubar"
where tinyjs >nul 2>nul || (echo tinyjs nao encontrado no PATH & pause & exit /b 1)
tinyjs dev
pause
