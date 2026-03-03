# Python NLP Service

Advanced NLP text analysis service using spaCy, NLTK, and scikit-learn.

## Features

- **Text Extraction**: Extract text from PDF, DOCX, and TXT files
- **Named Entity Recognition**: Extract persons, organizations, locations, dates
- **Keyword Extraction**: TF-IDF based keyword extraction
- **Text Summarization**: Extractive summarization
- **Sentiment Analysis**: Positive/negative/neutral classification
- **Readability Metrics**: Flesch Reading Ease, Gunning Fog, etc.
- **Text Statistics**: Word count, sentence count, reading time

## Setup

### Windows

1. Run setup script:
```bash
setup.bat
```

2. Start the service:
```bash
start.bat
```

### Manual Setup

1. Create virtual environment:
```bash
python -m venv venv
```

2. Activate virtual environment:
```bash
# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

4. Start the service:
```bash
python app.py
```

## API Endpoints

### Health Check
```
GET /health
```

### Analyze Text
```
POST /api/nlp/analyze
Body: { "text": "Your text here" }
```

### Extract from File
```
POST /api/nlp/extract
Form-data: file (PDF, DOCX, or TXT)
```

### Extract Entities
```
POST /api/nlp/entities
Body: { "text": "Your text here" }
```

### Extract Keywords
```
POST /api/nlp/keywords
Body: { "text": "Your text here", "max_keywords": 10 }
```

### Summarize Text
```
POST /api/nlp/summarize
Body: { "text": "Your text here", "max_length": 150 }
```

### Analyze Sentiment
```
POST /api/nlp/sentiment
Body: { "text": "Your text here" }
```

## Service runs on: http://localhost:5001
