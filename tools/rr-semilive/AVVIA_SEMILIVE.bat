@echo off
REM Avvia il semi-live sul PC di gara (doppio clic). Chiudere la finestra per fermarlo.
cd /d "%~dp0"
python rr_semilive.py
pause
