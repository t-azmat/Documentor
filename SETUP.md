# Documentor - Complete Setup Guide

## Backend Setup

### Prerequisites
- Node.js v18+ installed
- MongoDB installed and running (or MongoDB Atlas account)

### Installation Steps

1. **Navigate to backend directory:**
   ```powershell
   cd backend
   ```

2. **Install dependencies:**
   ```powershell
   npm install
   ```

3. **Configure environment variables:**
   ```powershell
   cp .env.example .env
   ```
   
   Edit `.env` file with your configurations:
   ```env
   PORT=5000
   NODE_ENV=development
   
   # MongoDB connection (local or Atlas)
   MONGODB_URI=mongodb://localhost:27017/documentor
   
   # JWT Secret (generate a secure random string)
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=7d
   
   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   
   # For production Stripe integration
   STRIPE_SECRET_KEY=sk_test_your_stripe_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

4. **Start MongoDB (if using local):**
   ```powershell
   # Windows - if MongoDB is installed as service, it should already be running
   # Or start manually:
   mongod
   ```

5. **Start the backend server:**
   ```powershell
   # Development mode (with auto-reload)
   npm run dev
   
   # Or production mode
   npm start
   ```

   The API will be available at: `http://localhost:5000`

### Testing the API

Test if the backend is running:
```powershell
Invoke-WebRequest -Uri http://localhost:5000/api/health
```

Should return:
```json
{
  "status": "success",
  "message": "Documentor API is running"
}
```

### API Endpoints Available

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires token)

#### Subscriptions
- `GET /api/subscriptions/plans` - Get all plans
- `GET /api/subscriptions/current` - Get user's subscription (requires token)

#### Users
- `GET /api/users/profile` - Get user profile (requires token)
- `PUT /api/users/profile` - Update profile (requires token)

---

## Frontend Setup

### Prerequisites
- Node.js v18+ installed

### Installation Steps

1. **Navigate to project root:**
   ```powershell
   cd ..  # if you're in backend folder
   ```

2. **Install dependencies:**
   ```powershell
   npm install
   ```

3. **Configure environment variables:**
   ```powershell
   cp .env.example .env
   ```
   
   The `.env` file should contain:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. **Start the development server:**
   ```powershell
   npm run dev
   ```

   The frontend will be available at: `http://localhost:3000`

---

## Running Both Frontend and Backend

### Option 1: Two Terminal Windows

**Terminal 1 - Backend:**
```powershell
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
npm run dev
```

### Option 2: Using a single command (optional)

You can install `concurrently`:
```powershell
npm install -D concurrently
```

Then add to root `package.json`:
```json
{
  "scripts": {
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "npm run dev",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\""
  }
}
```

Then run:
```powershell
npm run dev
```

---

## Testing the Complete Application

### 1. Register a New User

1. Open browser: `http://localhost:3000`
2. You'll be redirected to the login page
3. Click "Sign up for free"
4. Fill in the registration form:
   - Name: John Doe
   - Email: john@example.com
   - Password: password123
5. Click "Create account"
6. You'll be redirected to the pricing page

### 2. Select a Plan

1. On the pricing page, select a plan:
   - Free (starts immediately)
   - Premium or Team (for now, will just update the subscription in demo mode)
2. Click "Subscribe Now" or "Get Started"
3. You'll be redirected to the dashboard

### 3. View Dashboard

1. Dashboard shows:
   - Document statistics
   - Subscription status
   - Quick actions
   - Recent documents (sample data)

### 4. Check Subscription Status

Your subscription plan and usage limits are displayed in the sidebar card showing:
- Current plan (Free/Premium/Team)
- Documents remaining (for Free plan)
- Billing cycle and amount (for paid plans)

---

## Database Schema

The MongoDB database will automatically create collections when you register your first user:

### Users Collection
```javascript
{
  _id: ObjectId,
  name: "John Doe",
  email: "john@example.com",
  password: "hashed_password",
  authProvider: "local",
  subscription: {
    plan: "free",
    status: "active",
    billingCycle: "monthly",
    startDate: Date,
    amount: 0
  },
  usage: {
    documentsProcessed: 0,
    documentsThisMonth: 0,
    plagiarismChecksUsed: 0,
    storageUsed: 0
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## Features Implemented

### ✅ Backend
- User registration and login
- JWT authentication
- Password hashing with bcrypt
- Subscription management
- Usage tracking
- Password reset functionality
- Social login support (structure ready)
- Stripe integration (structure ready)

### ✅ Frontend
- Modern authentication UI
- Login/Signup/Forgot Password pages
- Pricing page with 3 tiers
- Dashboard with statistics
- Real-time subscription status
- Profile management
- Responsive design

---

## Troubleshooting

### Backend Issues

**MongoDB Connection Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:** Make sure MongoDB is running:
```powershell
mongod
```

**Port Already in Use:**
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution:** Change port in backend `.env` file or kill the process using port 5000

### Frontend Issues

**API Connection Error:**
```
Network Error / CORS Error
```
**Solution:** 
1. Make sure backend is running on port 5000
2. Check VITE_API_URL in frontend `.env`
3. Ensure CORS is enabled in backend (already configured)

**Dependencies Error:**
```
Module not found
```
**Solution:**
```powershell
rm -rf node_modules
npm install
```

---

## Next Steps

### Phase 2 Implementation
After you've confirmed the login and subscription management work:

1. **Document Upload Module**
   - File upload component
   - Support for .docx, .pdf, .txt
   - File preview

2. **AI Formatting Engine**
   - Integration with OpenAI/Claude API
   - Style templates (APA, MLA, IEEE)
   - Real-time formatting

3. **Citation Assistant**
   - Citation detection
   - Reference generation
   - CrossRef API integration

4. **And all other modules...**

---

## Support

For issues or questions:
1. Check the logs in both terminal windows
2. Verify all environment variables are set correctly
3. Ensure MongoDB is running
4. Check that both frontend and backend are on correct ports

---

**Your Documentor application is now ready to use! 🚀**
