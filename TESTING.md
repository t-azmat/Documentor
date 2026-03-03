# Testing Guide - Documentor

## Prerequisites Check

Before testing, ensure:
- ✅ MongoDB is installed and running
- ✅ Node.js v18+ is installed
- ✅ Both backend and frontend dependencies are installed

## Starting the Application

### Option 1: Automated Start (Recommended)
```powershell
.\start.ps1
```

### Option 2: Manual Start
**Terminal 1:**
```powershell
cd backend
npm run dev
```

**Terminal 2:**
```powershell
npm run dev
```

---

## Test Case 1: User Registration

### Steps:
1. Open browser: `http://localhost:3000`
2. Click "Sign up for free"
3. Fill in the form:
   - Name: `Test User`
   - Email: `test@example.com`
   - Password: `password123`
   - Confirm Password: `password123`
4. Check "I agree to the Terms of Service"
5. Click "Create account"

### Expected Result:
- ✅ User is created in MongoDB
- ✅ JWT token is generated
- ✅ User is redirected to pricing page
- ✅ User data is stored in browser localStorage

### Backend Verification:
Check MongoDB:
```javascript
// In MongoDB shell or Compass
use documentor
db.users.find({ email: "test@example.com" })
```

Should show:
```javascript
{
  _id: ObjectId("..."),
  name: "Test User",
  email: "test@example.com",
  subscription: {
    plan: "free",
    status: "active",
    billingCycle: "monthly"
  },
  usage: {
    documentsProcessed: 0,
    documentsThisMonth: 0
  }
}
```

---

## Test Case 2: User Login

### Steps:
1. Go to `http://localhost:3000/login`
2. Enter credentials:
   - Email: `test@example.com`
   - Password: `password123`
3. Click "Sign in"

### Expected Result:
- ✅ User is authenticated
- ✅ JWT token is stored
- ✅ Redirected to dashboard
- ✅ Dashboard shows user info and stats

### Backend API Test (Optional):
```powershell
# Test login endpoint
$body = @{
    email = "test@example.com"
    password = "password123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
```

Should return:
```json
{
  "status": "success",
  "token": "eyJhbGc...",
  "user": {
    "id": "...",
    "name": "Test User",
    "email": "test@example.com",
    "subscription": { "plan": "free" }
  }
}
```

---

## Test Case 3: Subscription Plans Display

### Steps:
1. After login, navigate to `/pricing` or click "Upgrade Now"
2. View all three plans

### Expected Result:
- ✅ Free plan shows $0/month
- ✅ Premium plan shows $19.99/month or $179.99/year
- ✅ Team plan shows $49.99/month or $479.99/year
- ✅ Toggle between Monthly and Annual works
- ✅ "Save 25%" badge shows for annual billing

---

## Test Case 4: View Current Subscription

### Steps:
1. Login and go to dashboard
2. Check subscription card in sidebar

### Expected Result:
- ✅ Shows "Free Plan"
- ✅ Shows "5 documents remaining this month"
- ✅ "Upgrade Now" button visible

### Backend API Test:
```powershell
# Get your token from login response
$token = "your_jwt_token_here"

Invoke-RestMethod -Uri "http://localhost:5000/api/subscriptions/current" -Method Get -Headers @{Authorization="Bearer $token"}
```

Should return:
```json
{
  "status": "success",
  "subscription": {
    "plan": "free",
    "status": "active",
    "billingCycle": "monthly"
  },
  "usage": {
    "documentsProcessed": 0,
    "documentsThisMonth": 0,
    "plagiarismChecksUsed": 0,
    "storageUsed": 0
  },
  "limits": {
    "documentsPerMonth": 5,
    "plagiarismChecksPerMonth": 0,
    "storageLimit": 104857600
  }
}
```

---

## Test Case 5: Dashboard Statistics

### Steps:
1. Login and view dashboard
2. Check statistics cards

### Expected Result:
- ✅ Documents Processed: 0
- ✅ This Month: 0
- ✅ Plagiarism Checks: 0
- ✅ Storage Used: 0 Bytes

These update based on user activity (will be implemented in Phase 2).

---

## Test Case 6: Password Reset Request

### Steps:
1. Go to login page
2. Click "Forgot password?"
3. Enter email: `test@example.com`
4. Click "Reset password"

### Expected Result:
- ✅ Shows "Check your email" message
- ✅ Backend generates reset token (check console logs)

Note: Email sending requires SMTP configuration in backend/.env

---

## Test Case 7: User Profile

### Steps:
1. Login to dashboard
2. Check user info in sidebar

### Expected Result:
- ✅ Shows user name
- ✅ Shows user email
- ✅ Avatar placeholder visible

---

## Test Case 8: Logout

### Steps:
1. From dashboard, click "Logout"

### Expected Result:
- ✅ User is logged out
- ✅ Token removed from localStorage
- ✅ Redirected to login page
- ✅ Cannot access `/dashboard` without login

---

## API Endpoints Testing (Using PowerShell)

### Health Check
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/health"
```

### Get All Plans (Public)
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/subscriptions/plans"
```

### Register User
```powershell
$user = @{
    name = "John Doe"
    email = "john@example.com"
    password = "password123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" -Method Post -Body $user -ContentType "application/json"
```

### Login User
```powershell
$credentials = @{
    email = "john@example.com"
    password = "password123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $credentials -ContentType "application/json"
$token = $response.token
```

### Get Current User (Protected)
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/auth/me" -Method Get -Headers @{Authorization="Bearer $token"}
```

### Get User Profile (Protected)
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/users/profile" -Method Get -Headers @{Authorization="Bearer $token"}
```

### Get User Usage (Protected)
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/users/usage" -Method Get -Headers @{Authorization="Bearer $token"}
```

---

## Database Verification

### View All Users
```javascript
use documentor
db.users.find().pretty()
```

### View Specific User
```javascript
db.users.findOne({ email: "test@example.com" })
```

### Check User Count
```javascript
db.users.count()
```

### View User Subscriptions
```javascript
db.users.find({}, { email: 1, "subscription.plan": 1, "subscription.status": 1 })
```

---

## Common Issues & Solutions

### Issue: "Cannot connect to MongoDB"
**Solution:**
```powershell
# Start MongoDB service
net start MongoDB
# Or start manually
mongod
```

### Issue: "Port 5000 already in use"
**Solution:**
```powershell
# Find process using port 5000
netstat -ano | findstr :5000
# Kill the process
taskkill /PID <PID> /F
```

### Issue: "CORS error in browser"
**Solution:**
- Ensure backend is running on port 5000
- Check FRONTEND_URL in backend/.env is set to http://localhost:3000

### Issue: "Token expired or invalid"
**Solution:**
- Logout and login again
- Check JWT_SECRET matches between requests

---

## Success Criteria

All features working correctly:
- ✅ User can register
- ✅ User can login
- ✅ User can view dashboard
- ✅ Subscription status displays correctly
- ✅ Usage statistics show properly
- ✅ Free plan limits are enforced
- ✅ User can logout
- ✅ Protected routes require authentication

---

## Next Phase Testing

Once modules 1-9 are implemented, we'll test:
- Document upload and processing
- AI formatting engine
- Citation generation
- Grammar checking
- Plagiarism detection
- Export functionality
- Team collaboration
- Admin panel

---

**Your authentication and subscription system is ready to test! 🎉**
