# Documentor Testing Report

This file records the testing completed for the current Documentor build and the recommended test cases for each major functionality.

## Test Environment

- Frontend: React 18 + Vite
- Backend: Node.js + Express
- Python NLP service: Flask
- Database: MongoDB / MongoDB Atlas compatible
- Local frontend URL: `http://localhost:5173`
- Local backend URL: `http://localhost:5000`
- Local Python NLP URL: `http://localhost:5001`

## Automated / Smoke Checks Completed

### Frontend Build

Command:

```powershell
npm run build
```

Result: Passed.

Notes:

- Vite production build completed successfully.
- Vite reported a chunk-size warning because the frontend bundle is larger than 500 KB after minification. This is a performance warning, not a build failure.

### Backend JavaScript Syntax Check

Command:

```powershell
$files = @(rg --files backend -g '*.js')
foreach ($file in $files) {
  node --check $file
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Result: Passed.

Scope:

- Checked backend controllers, routes, models, services, middleware, and server entrypoint.

### Python Syntax Check

Command:

```powershell
python -m py_compile python-nlp-service\app.py python-nlp-service\citation.py python-nlp-service\grammar_enhancer.py
```

Result: Passed.

Scope:

- Python NLP service entrypoint.
- Citation manager.
- Grammar enhancer.

### Citation Extraction Smoke Tests

Status: Passed during local smoke testing.

Cases verified:

- APA-style in-text citations and references.
- IEEE numeric citations and references.
- Mixed citation text without false-positive reference-list extraction.

Expected behavior:

- In-text citations are extracted with line/context metadata.
- References section is detected separately from body text.
- Citation-to-reference mapping works for common APA and IEEE patterns.

### Grammar Enhancement Smoke Tests

Status: Passed during local smoke testing.

Cases verified:

- Basic fallback enhancement can run without loading the model.
- Hugging Face generation warning was removed by using `max_new_tokens` without conflicting `max_length`.
- Prompt echo cleanup removes repeated text such as `Improve grammar and clarity:`.

Expected behavior:

- If the trained model is unavailable, the service falls back gracefully.
- Enhancement output should not repeat the instruction prompt.
- Grammar enhancement should preserve readable paragraph structure.

## Functional Test Matrix

## 1. Authentication

Files / modules:

- `src/pages/Auth/Login.jsx`
- `src/pages/Auth/Signup.jsx`
- `src/pages/Auth/ForgotPassword.jsx`
- `backend/controllers/authController.js`
- `backend/routes/authRoutes.js`
- `backend/models/User.js`

Test cases:

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| User signup | Fill signup form with valid name, email, and password | Account is created and user is redirected to pricing/dashboard flow | Manual test required |
| Password mismatch | Enter different password and confirm password | Error message is shown | Manual test required |
| User login | Login with valid credentials | JWT is stored and user reaches dashboard | Manual test required |
| Invalid login | Login with wrong password | Error message is shown | Manual test required |
| Forgot password | Submit registered email | Reset email request is accepted | Manual test required |
| Protected route | Open dashboard without token | User is redirected to login | Manual test required |
| Admin role access | Login as admin and open `/admin` | Admin-only tabs become available | Manual test required |

## 2. Theme / UI Design

Files / modules:

- `src/hooks/useTheme.js`
- `src/components/Layout/Layout.jsx`
- `src/index.css`
- `src/pages/Auth/Login.jsx`
- `src/pages/Admin/Admin.jsx`

Test cases:

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Dark mode toggle | Click theme icon in layout | UI switches to dark mode | Manual test required |
| Light mode toggle | Click theme icon again | UI switches to light mode | Manual test required |
| Persistence | Refresh after switching theme | Selected theme remains active | Manual test required |
| Admin overview contrast | Open admin overview in dark mode | Stat values and labels are readable | Fixed and build-checked |
| Mobile sidebar | Open app on small viewport and toggle sidebar | Sidebar opens/closes without overlap | Manual test required |

## 3. Dashboard

Files / modules:

- `src/pages/Dashboard/Dashboard.jsx`
- `backend/controllers/userController.js`
- `backend/controllers/subscriptionController.js`

Test cases:

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Dashboard load | Login and open `/dashboard` | User stats, subscription, and quick actions render | Manual test required |
| Subscription summary | Use free/premium user | Remaining document count or premium label displays correctly | Manual test required |
| Quick upload action | Click upload document quick action | Upload modal opens | Manual test required |
| Project/template shortcuts | Click project/template quick actions | Correct routes open | Manual test required |

## 4. Document Upload and Management

Files / modules:

- `src/pages/Documents/Documents.jsx`
- `src/components/UploadDocument/UploadDocument.jsx`
- `src/components/DocumentWorkspace/DocumentWorkspace.jsx`
- `backend/controllers/documentController.js`
- `backend/routes/documentRoutes.js`
- `backend/models/Document.js`
- `backend/services/fileExtractorService.js`

Test cases:

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Upload PDF | Upload valid PDF | Document is saved and listed | Manual test required |
| Upload DOCX | Upload valid DOCX | Document is saved and listed | Manual test required |
| Upload TXT | Upload valid TXT | Document is saved and listed | Manual test required |
| Invalid file type | Upload unsupported file | Validation error is shown | Manual test required |
| Search documents | Type a known document title | Matching document is shown | Manual test required |
| Status filter | Change document status filter | List updates according to status | Manual test required |
| Open workspace | Click Open on document | Workspace opens with document details | Manual test required |
| Delete document | Delete existing document | Document is removed and stats update | Manual test required |
| Download document | Click download | Original/processed file downloads | Manual test required |

## 5. File Extraction

Files / modules:

- `python-nlp-service/app.py`
- `python-nlp-service/file_extractor.py`
- `python-nlp-service/pdf_extractor.py`
- `python-nlp-service/docx_extractor.py`
- `backend/services/fileExtractorService.js`

Test cases:

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Python health | `GET /health` on Python service | Returns healthy JSON response | Manual/API test required |
| Simple extraction | Upload text file to `/api/extract/file` | Text and word count returned | Manual/API test required |
| Structured DOCX extraction | Upload DOCX to `/api/extract/structured` | Blocks, headings, TOC, word count returned | Manual/API test required |
| Structured PDF extraction | Upload PDF to `/api/extract/structured` | Text blocks and metadata returned | Manual/API test required |
| Backend extraction proxy | Upload document through backend | Backend sends file to Python service and stores extracted metadata | Manual/API test required |

## 6. Grammar Enhancer

Files / modules:

- `src/pages/GrammarEnhancer/GrammarEnhancerPage.jsx`
- `backend/controllers/grammarController.js`
- `backend/services/grammarService.js`
- `python-nlp-service/grammar_enhancer.py`
- `python-nlp-service/app.py`

Test cases:

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Enhance pasted text | Paste paragraph and click Enhance | Enhanced text is returned | Smoke tested |
| Empty text validation | Click Enhance with no input | Error message is shown | Manual test required |
| Load file | Upload PDF/DOCX/TXT in grammar page | Text is extracted into editor | Manual test required |
| Diff view | Enhance text with changes | Original/enhanced comparison highlights changes | Manual test required |
| Copy enhanced text | Click copy | Clipboard receives enhanced text | Manual test required |
| Download enhanced text | Click download | `.txt` file is downloaded | Manual test required |
| Apply enhanced text | Click Use This Version | Enhanced text replaces original editor text | Manual test required |
| Prompt echo prevention | Use model output that repeats prompt | Prompt phrase is removed from final result | Smoke tested |

Known limitation:

- If a trained grammar checkpoint is not deployed with `GRAMMAR_MODEL_PATH`, the service uses fallback/model defaults.

## 7. Citation Manager

Files / modules:

- `src/pages/Citations/Citations.jsx`
- `src/components/CitationManager/CitationManager.jsx`
- `backend/controllers/citationController.js`
- `backend/routes/citationRoutes.js`
- `python-nlp-service/citation.py`
- `python-nlp-service/app.py`

Test cases:

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Extract APA citations | Upload/paste APA-style document | Citations and references are detected | Smoke tested |
| Extract IEEE citations | Upload/paste IEEE-style document | Numeric citations and references are detected | Smoke tested |
| Detect style | Analyze citation text | Style returns APA/IEEE/etc. where detectable | Smoke tested |
| Match citations | Analyze document with reference list | Citation-reference mapping is returned | Smoke tested |
| Manual citation add | Add author/title/year/source manually | Citation appears in selected style | Manual test required |
| Edit citation | Edit existing manual citation | Citation list updates | Manual test required |
| Delete citation | Delete manual citation | Citation is removed | Manual test required |
| Export citations | Export citation list | Text file downloads | Manual test required |
| Reference library persistence | Save citation document as reference | Library remains after page refresh | Manual test required |

Known limitation:

- AI semantic citation matching is opt-in through `ENABLE_AI_CITATION_MATCHING=true` because it can load heavier sentence-transformer models.

## 8. Formatting Engine

Files / modules:

- `src/pages/Formatting/FormattingPage.jsx`
- `src/components/FormatDocument/DocumentFormatter.jsx`
- `backend/controllers/formattingJobController.js`
- `backend/services/formattingJobQueue.js`
- `backend/models/FormattingJob.js`
- `python-nlp-service/formatting_engine.py`
- `python-nlp-service/stateful_formatter.py`
- `formatting_engine/`

Test cases:

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Create formatting job | Select uploaded document and target style | Job is created in backend | Manual test required |
| Queue processing | Start formatting job | Job status moves through pending/processing/completed or failed | Manual test required |
| APA formatting | Format document as APA | Preview/export follows APA layout rules | Manual test required |
| IEEE formatting | Format document as IEEE | Preview/export follows IEEE layout rules | Manual test required |
| Download formatted DOCX | Complete formatting job and download | DOCX artifact downloads | Manual test required |
| Error handling | Stop Python service and start job | Backend returns clear failure status | Manual test required |
| Large document mode | Submit large document | Stateful/SSE formatter streams progress | Manual test required |

Known limitations:

- Free-tier hosts may struggle with heavy document extraction or model-based formatting.
- Local/generated runtime output is ignored and should not be committed.

## 9. Plagiarism Checker

Files / modules:

- `src/pages/Plagiarism/Plagiarism.jsx`
- `src/components/PlagiarismChecker/PlagiarismDetector.jsx`
- `python-nlp-service/plagiarism_detector.py`
- `python-nlp-service/app.py`

Test cases:

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Text plagiarism check | Paste text and run check | Similarity result is returned | Manual test required |
| Reference library check | Save reference document, then check related text | Matching segments are detected | Manual test required |
| Online check endpoint | Run online plagiarism check | Sources/similarity are returned where available | Manual test required |
| Empty input | Submit no text | Validation error is shown | Manual test required |

Known limitation:

- Online/source matching depends on available APIs/network and may be limited in free deployment.

## 10. AI Detector

Files / modules:

- `src/pages/AIDetector/AIDetectorPage.jsx`
- `src/components/AIDetector/AIDetector.jsx`
- `python-nlp-service/app.py`

Test cases:

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Analyze human-like text | Submit varied human-written text | Detector returns score/label/features | Manual test required |
| Analyze AI-like text | Submit uniform AI-style text | Detector returns higher AI probability | Manual test required |
| Short text | Submit very short text | Returns too-short/validation response | Manual test required |
| Feature breakdown | Analyze valid text | Burstiness, sentence variance, length, and filler signals display | Manual test required |

## 11. Admin Panel

Files / modules:

- `src/pages/Admin/Admin.jsx`
- `src/pages/Admin/AdminOverview.jsx`
- `src/pages/Admin/UserManagement.jsx`
- `src/pages/Admin/SystemLogs.jsx`
- `src/pages/Admin/StyleTemplates.jsx`
- `src/pages/Admin/FormatTester.jsx`
- `src/pages/Admin/ProjectsOverview.jsx`
- `backend/controllers/adminController.js`
- `backend/routes/adminRoutes.js`
- `backend/services/adminBootstrapService.js`
- `backend/services/adminLogService.js`

Test cases:

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Public overview | Open `/admin` without admin login | Overview stats load in stats-only mode | Manual test required |
| Admin overview | Login as admin and open `/admin` | All admin tabs are available | Manual test required |
| User list | Open User Management | Users are listed | Manual test required |
| Update user | Change user status/role where allowed | User updates and audit log records action | Manual test required |
| System logs | Open logs tab | Recent logs display with filters | Manual test required |
| Style templates | Create/edit/delete style template | Template list updates | Manual test required |
| Projects overview | Open projects tab | Project summaries load | Manual test required |
| Formatting jobs admin | Open formatting jobs/tester tab | Job data/actions are available | Manual test required |

## 12. Deployment Configuration

Files / modules:

- `vercel.json`
- `render.yaml`
- `.env.example`
- `backend/.env.example`
- `python-nlp-service/.env.example`
- `DEPLOYMENT.md`

Test cases:

| Test Case | Steps | Expected Result | Status |
|---|---|---|---|
| Frontend Vercel build | Deploy/import on Vercel | Vite build succeeds and SPA routes work | Config prepared |
| Backend Render health | Deploy backend and open `/api/health` | Health JSON returned | Manual deploy test required |
| Python Render health | Deploy NLP service and open `/health` | Health JSON returned | Manual deploy test required |
| CORS | Open Vercel frontend and call backend | Requests are allowed for configured `FRONTEND_URL` | Manual deploy test required |
| MongoDB Atlas | Backend connects with Atlas URI | Server starts and persists data | Manual deploy test required |

## Current Verification Summary

Passed:

- Frontend production build.
- Backend JavaScript syntax check.
- Python syntax check for key NLP modules.
- Citation extraction smoke checks.
- Grammar fallback and prompt-cleanup smoke checks.

Pending manual tests:

- Full browser-based workflow testing.
- Live backend and Python service health checks after deployment.
- File upload/download tests with real PDFs and DOCX files.
- Admin role workflows.
- Payment/Stripe flows if billing is enabled.

## Recommended Final Acceptance Flow

1. Start backend, Python NLP service, and frontend locally.
2. Register or login as a normal user.
3. Upload a PDF and DOCX document.
4. Run grammar enhancement on pasted text and uploaded text.
5. Run citation extraction on APA and IEEE samples.
6. Run formatting on one uploaded document.
7. Run plagiarism and AI detection on sample text.
8. Login as admin and verify overview, users, logs, templates, projects, and formatting jobs.
9. Deploy using `DEPLOYMENT.md`.
10. Repeat health checks and one end-to-end document workflow on the deployed URLs.
