# Quick Start Guide

## Easy Start (Recommended)

Just double-click or run:
```powershell
.\start.ps1
```

This will:
1. Start the backend server in one window
2. Start the frontend server in another window
3. Show you both URLs

## Manual Start

### Terminal 1 - Backend
```powershell
cd backend
npm install  # first time only
npm run dev
```

### Terminal 2 - Frontend
```powershell
npm install  # first time only
npm run dev
```

## First Time Setup

1. **Install MongoDB**
   - Download from https://www.mongodb.com/try/download/community
   - Or use MongoDB Atlas (cloud)

2. **Configure Backend**
   - Edit `backend/.env`
   - Set MongoDB URI
   - Set JWT secret

3. **Run the app**
   ```powershell
   .\start.ps1
   ```

4. **Open browser**
   - Go to http://localhost:3000
   - Register a new account
   - Explore the dashboard!

## URLs

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Health: http://localhost:5000/api/health

## Default Test Account

You'll need to register your own account on first use.
