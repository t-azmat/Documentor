# Documentor Deployment Guide

This repo is prepared for a free-tier friendly deployment:

- Frontend: Vercel
- Backend API: Render Web Service
- Python NLP service: Render Web Service
- Database: MongoDB Atlas

## 1. MongoDB Atlas

1. Create a free Atlas cluster.
2. Create a database user.
3. Add your Render outbound access. For a student/demo deployment you can temporarily allow `0.0.0.0/0`, then tighten it later.
4. Copy the connection string and set the database name, for example:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/documentor?retryWrites=true&w=majority
```

## 2. Render Services

This repo includes `render.yaml` with two services:

- `documentor-backend`
- `documentor-nlp`

In Render:

1. Click **New +** > **Blueprint**.
2. Connect this GitHub repo.
3. Render will detect `render.yaml`.
4. Fill all `sync: false` environment variables.

Backend required variables:

```env
MONGODB_URI=<your MongoDB Atlas URI>
JWT_SECRET=<long random secret>
FRONTEND_URL=https://<your-vercel-app>.vercel.app
FRONTEND_URLS=https://<your-vercel-app>.vercel.app,http://localhost:5173
PYTHON_NLP_URL=https://documentor-nlp.onrender.com
PYTHON_GRAMMAR_SERVICE_URL=https://documentor-nlp.onrender.com
ADMIN_EMAIL=<your admin email>
ADMIN_PASSWORD=<strong admin password>
```

Python NLP useful variables:

```env
ENABLE_AI_CITATION_MATCHING=false
FORMATTING_ENGINE_LOCAL_ONLY=true
FORMATTING_ENGINE_USE_AI=false
```

Notes:

- Render free services can sleep after inactivity, so first requests may be slow.
- The Python service has heavy ML dependencies. If Render free fails during install or memory usage, move only `documentor-nlp` to Hugging Face Spaces, RunPod, Modal, or a VPS, then update `PYTHON_NLP_URL`.

## 3. Vercel Frontend

This repo includes `vercel.json` for the Vite SPA.

In Vercel:

1. Import the repo.
2. Framework preset should be **Vite**.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add environment variables:

```env
VITE_API_URL=https://documentor-backend.onrender.com/api
VITE_PYTHON_NLP_URL=https://documentor-nlp.onrender.com
VITE_NLP_API_URL=https://documentor-nlp.onrender.com
```

Redeploy after setting env vars.

## 4. Health Checks

After deployment, check:

```text
https://documentor-backend.onrender.com/api/health
https://documentor-nlp.onrender.com/health
```

Then open:

```text
https://<your-vercel-app>.vercel.app
```

## 5. Free-Tier Reality Check

The frontend, backend, database, and CPU NLP service can start on free tiers. Heavy grammar/model inference may be slow or fail on free CPU/memory. If that happens, keep the frontend/backend/database as-is and move only the Python NLP service to a stronger host.
