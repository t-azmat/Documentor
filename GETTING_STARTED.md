# 🚀 Documentor - Getting Started

## What Has Been Created

A complete **authentication and subscription management system** for Documentor - your AI-powered research paper formatter.

### ✅ What's Working Right Now

#### Backend API (Node.js + Express + MongoDB)
- User registration and login
- JWT authentication 
- Password reset functionality
- Subscription management (Free, Premium, Team plans)
- Usage tracking and limits
- User profile management
- All REST API endpoints documented

#### Frontend (React + Vite + Tailwind)
- Professional login/signup pages (QuillBot-inspired design)
- Pricing page with 3 subscription tiers
- User dashboard with statistics
- Real-time subscription status display
- Protected routes
- Responsive design

---

## 🎯 Quick Start (In 5 Minutes)

### Step 1: Install MongoDB (If Not Already Installed)
Download and install: https://www.mongodb.com/try/download/community

### Step 2: Start Everything
Open PowerShell in the Documentor folder and run:
```powershell
.\start.ps1
```

This opens two windows:
- Backend server on http://localhost:5000
- Frontend app on http://localhost:3000

### Step 3: Test It Out
1. Open browser: http://localhost:3000
2. Click "Sign up for free"
3. Register with your email
4. Explore the dashboard!

---

## 📁 Project Structure

```
Documentor/
├── backend/                  # Node.js Backend
│   ├── config/              # Database config
│   ├── controllers/         # Business logic
│   ├── middleware/          # Auth & error handling
│   ├── models/              # MongoDB schemas
│   ├── routes/              # API endpoints
│   ├── utils/               # Helper functions
│   ├── server.js            # Main server file
│   └── .env                 # Configuration
│
├── src/                      # React Frontend
│   ├── pages/
│   │   ├── Auth/            # Login, Signup, Forgot Password
│   │   ├── Pricing/         # Subscription plans
│   │   └── Dashboard/       # Main dashboard
│   ├── services/            # API calls
│   ├── store/               # State management
│   └── App.jsx              # Main app component
│
├── start.ps1                # Start both servers
├── QUICKSTART.md            # This file
├── SETUP.md                 # Detailed setup guide
├── TESTING.md               # Testing procedures
└── PROJECT_STATUS.md        # What's done & what's next
```

---

## 🔐 Features You Can Test Now

### 1. User Registration
- Email/password signup
- Input validation
- Password confirmation
- Terms acceptance
- Auto-login after registration

### 2. User Login
- Email/password authentication
- JWT token generation
- Remember me option
- Error handling

### 3. Password Reset
- Email-based reset flow
- Token generation
- Reset confirmation

### 4. Subscription Plans
- **Free Plan**: 5 documents/month, basic formatting
- **Premium Plan**: $19.99/month - Unlimited docs, all features
- **Team Plan**: $49.99/month - Everything + team features
- Monthly/Annual billing toggle
- Plan comparison

### 5. User Dashboard
- Document statistics
- Usage tracking
- Subscription status
- Quick actions
- Profile information

### 6. Protected Routes
- Dashboard requires login
- Automatic redirect to login
- Token-based authentication
- Session persistence

---

## 🔍 What To Test

Use the [TESTING.md](TESTING.md) file for comprehensive test cases, or try these quick tests:

**Test 1: Register a new user**
- Go to http://localhost:3000
- Click "Sign up for free"
- Fill in details and submit
- ✅ Should redirect to pricing page

**Test 2: Login**
- Go to http://localhost:3000/login
- Enter your credentials
- ✅ Should redirect to dashboard

**Test 3: View subscription**
- After login, check the sidebar
- ✅ Should show "Free Plan" with usage limits

**Test 4: Check API**
- Open http://localhost:5000/api/health
- ✅ Should return success message

---

## 📚 Documentation Files

- **README.md** - Main project overview
- **QUICKSTART.md** - This file (quick start)
- **SETUP.md** - Detailed setup instructions
- **TESTING.md** - Complete testing guide
- **PROJECT_STATUS.md** - What's done, what's next
- **backend/README.md** - Backend API documentation

---

## 🎨 Design Philosophy

The UI is inspired by **QuillBot**:
- Clean, minimalist design
- Smooth animations and transitions
- Card-based layouts
- Professional color scheme (Blue + Purple)
- Mobile-responsive
- Intuitive navigation

---

## 🔧 Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Auth**: JWT + Bcrypt
- **Payments**: Stripe (structure ready)
- **Email**: Nodemailer (structure ready)

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **State**: Zustand
- **HTTP**: Axios
- **Icons**: React Icons

---

## 🐛 Troubleshooting

### MongoDB Not Running?
```powershell
net start MongoDB
```

### Port Already in Use?
```powershell
# Kill process on port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Dependencies Issues?
```powershell
rm -rf node_modules
npm install
```

### Frontend Not Loading?
- Check backend is running on port 5000
- Check `.env` has correct API URL
- Clear browser cache

---

## 📡 API Endpoints

All endpoints documented in `backend/README.md`. Quick reference:

**Public:**
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/subscriptions/plans` - Get plans

**Protected (requires token):**
- `GET /api/auth/me` - Current user
- `GET /api/subscriptions/current` - User subscription
- `GET /api/users/profile` - User profile
- `GET /api/users/usage` - Usage statistics

---

## 🎯 Next Steps

### Immediate
1. **Test the current system** - Make sure login, signup, and dashboard work
2. **Review the code** - Understand how it's structured
3. **Check MongoDB** - Verify users are being saved

### Phase 2 (Next Development)
1. **Module 1**: Document Upload System
2. **Module 2**: AI Formatting Engine
3. **Module 6**: Real-time Preview
4. **Module 7**: Export Functionality

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for detailed roadmap.

---

## 🆘 Need Help?

1. Check the error logs in both terminal windows
2. Review TESTING.md for common issues
3. Verify environment variables in `.env` files
4. Make sure MongoDB is running
5. Check that ports 3000 and 5000 are free

---

## 🎉 Success Checklist

- [ ] MongoDB installed and running
- [ ] Backend starts without errors
- [ ] Frontend loads on port 3000
- [ ] Can register a new user
- [ ] Can login successfully
- [ ] Dashboard displays correctly
- [ ] Subscription status shows
- [ ] Can logout and login again

Once all checked, you're ready to start building the document processing modules!

---

## 💼 Production Deployment (Future)

When ready for production:

1. **Environment**:
   - MongoDB Atlas for database
   - Heroku/Vercel/Railway for backend
   - Vercel/Netlify for frontend

2. **Configuration**:
   - Set production environment variables
   - Enable Stripe live mode
   - Configure email service
   - Set up domain and SSL

3. **Security**:
   - Rotate JWT secrets
   - Enable rate limiting
   - Add Helmet.js middleware
   - Set up CORS properly

---

**Your Documentor application is ready to use and extend! 🚀**

Have questions? Check the other documentation files or start implementing Module 1!
