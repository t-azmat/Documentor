# Setting Up Python NLP Service

## Quick Start

1. Navigate to the Python NLP service directory:
```powershell
cd python-nlp-service
```

2. Run the setup script (Windows):
```powershell
.\setup.bat
```

This will:
- Create a Python virtual environment
- Install all required packages
- Download the spaCy English model

3. Start the Python NLP service:
```powershell
.\start.bat
```

The service will run on **http://localhost:5001**

## Manual Setup (if scripts don't work)

1. Create virtual environment:
```powershell
python -m venv venv
```

2. Activate virtual environment:
```powershell
.\venv\Scripts\activate
```

3. Install dependencies:
```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

4. Download spaCy model:
```powershell
python -m spacy download en_core_web_sm
```

5. Start the service:
```powershell
python app.py
```

## Verify Service is Running

Open your browser and go to: http://localhost:5001/health

You should see:
```json
{
  "status": "healthy",
  "service": "Python NLP Service"
}
```

## Integration with Main App

The Python NLP service is now integrated with your frontend. When you click "NLP Analysis" on a document:

1. Frontend sends text to Python service (port 5001)
2. Python service performs advanced NLP analysis
3. Results are sent back and saved to your Node.js backend (port 5000)
4. Analysis is displayed in the NLP Analysis modal

## Services Running

- **Frontend**: http://localhost:3000 (Vite React)
- **Backend API**: http://localhost:5000 (Node.js/Express)
- **Python NLP**: http://localhost:5001 (Flask)

## Troubleshooting

If you get module errors:
```powershell
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

If spaCy model is missing:
```powershell
python -m spacy download en_core_web_sm
```

If port 5001 is in use:
- Edit `app.py` and change the port number in the last line
- Update `VITE_PYTHON_NLP_URL` in your `.env` file
