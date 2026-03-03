# Documentor Backend API

Backend API for Documentor - AI-Powered Research Paper Formatter

## Features

- ✅ User Authentication (Register, Login, Social Login)
- ✅ JWT-based Authorization
- ✅ Subscription Management (Free, Premium, Team)
- ✅ Stripe Payment Integration
- ✅ Usage Tracking & Limits
- ✅ Password Reset
- ✅ User Profile Management

## Tech Stack

- **Node.js** + **Express.js**
- **MongoDB** with Mongoose
- **JWT** for authentication
- **Bcrypt** for password hashing
- **Stripe** for payments
- **Nodemailer** for emails

## Installation

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your configuration:
   - MongoDB connection string
   - JWT secret
   - Stripe API keys
   - Email credentials

3. **Start the server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/social` - Social login (Google, Facebook, Apple)
- `POST /api/auth/forgot-password` - Request password reset
- `PUT /api/auth/reset-password/:token` - Reset password
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Subscriptions
- `GET /api/subscriptions/plans` - Get all subscription plans
- `GET /api/subscriptions/current` - Get current subscription (Protected)
- `POST /api/subscriptions/create-checkout` - Create Stripe checkout (Protected)
- `POST /api/subscriptions/update` - Update subscription (Protected)
- `POST /api/subscriptions/cancel` - Cancel subscription (Protected)
- `POST /api/subscriptions/webhook` - Stripe webhook

### Users
- `GET /api/users/profile` - Get user profile (Protected)
- `PUT /api/users/profile` - Update user profile (Protected)
- `PUT /api/users/password` - Update password (Protected)
- `GET /api/users/usage` - Get usage statistics (Protected)
- `DELETE /api/users/account` - Delete account (Protected)

## Database Schema

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  authProvider: String (local/google/facebook/apple),
  subscription: {
    plan: String (free/premium/team),
    status: String,
    billingCycle: String,
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    startDate: Date,
    endDate: Date,
    amount: Number
  },
  usage: {
    documentsProcessed: Number,
    documentsThisMonth: Number,
    plagiarismChecksUsed: Number,
    storageUsed: Number,
    lastResetDate: Date
  },
  timestamps: true
}
```

## Subscription Plans

### Free Plan
- 5 documents/month
- Basic formatting
- 100MB storage

### Premium Plan ($19.99/month)
- Unlimited documents
- All formatting styles
- 10 plagiarism checks/month
- 10GB storage

### Team Plan ($49.99/month)
- Everything in Premium
- 10 team members
- Unlimited plagiarism checks
- 100GB storage
- API access

## Authentication Flow

1. User registers/logs in
2. Server generates JWT token
3. Token sent to client
4. Client includes token in Authorization header
5. Server validates token on protected routes

## Payment Flow

1. User selects plan on frontend
2. Frontend calls `/api/subscriptions/create-checkout`
3. Backend creates Stripe checkout session
4. User completes payment on Stripe
5. Stripe webhook notifies backend
6. Backend updates user subscription

## Error Handling

All errors return JSON:
```json
{
  "status": "error",
  "message": "Error message here"
}
```

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- CORS protection
- Input validation
- Rate limiting (recommended to add)
- Helmet.js (recommended to add)

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## Production

Set `NODE_ENV=production` in your `.env` file.

## Testing

Use tools like Postman or Thunder Client to test endpoints.

Sample request:
```bash
# Register
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}

# Login
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```
