@echo off
echo Setting up Python NLP Service...

REM Create virtual environment
python -m venv venv

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

REM Download spaCy model
python -m spacy download en_core_web_sm

echo Setup complete!
echo To start the service, run: start.bat
pause
