@echo off
echo Starting Python NLP Service...

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Start Flask server
python app.py

pause
