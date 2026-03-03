# Documentor - System Architecture

## Current System Architecture (Phase 1)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│                     http://localhost:3000                        │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │ HTTP/HTTPS Requests
               │ (JWT Token in Headers)
               │
┌──────────────▼──────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Auth Pages    │  │  Pricing Page   │  │   Dashboard     │ │
│  │  - Login        │  │  - Free Plan    │  │  - Statistics   │ │
│  │  - Signup       │  │  - Premium      │  │  - Profile      │ │
│  │  - Forgot Pass  │  │  - Team         │  │  - Subscription │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                     │           │
│           └────────────────────┼─────────────────────┘           │
│                                │                                 │
│                    ┌───────────▼───────────┐                    │
│                    │    API Service        │                    │
│                    │   (Axios Client)      │                    │
│                    │  - Auth API           │                    │
│                    │  - Subscription API   │                    │
│                    │  - User API           │                    │
│                    └───────────┬───────────┘                    │
│                                │                                 │
│                    ┌───────────▼───────────┐                    │
│                    │   State Management    │                    │
│                    │     (Zustand)         │                    │
│                    │  - User State         │                    │
│                    │  - Auth State         │                    │
│                    │  - Subscription       │                    │
│                    └───────────────────────┘                    │
│                                                                   │
└───────────────────────────┬───────────────────────────────────────┘
                            │
                            │ REST API Calls
                            │ Authorization: Bearer <JWT>
                            │
┌───────────────────────────▼───────────────────────────────────────┐
│                   BACKEND API (Express.js)                        │
│                   http://localhost:5000/api                       │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     API ROUTES                              │ │
│  │                                                             │ │
│  │  /api/auth/*          /api/subscriptions/*   /api/users/*  │ │
│  │  - register           - plans               - profile      │ │
│  │  - login              - current             - usage        │ │
│  │  - forgot-password    - create-checkout     - password     │ │
│  │  - reset-password     - update              - account      │ │
│  │  - me                 - cancel                              │ │
│  │  - logout             - webhook                             │ │
│  └──────┬───────────────────────┬────────────────────┬────────┘ │
│         │                       │                    │           │
│  ┌──────▼───────┐        ┌─────▼────────┐    ┌─────▼────────┐ │
│  │   Auth       │        │ Subscription │    │     User     │ │
│  │ Controller   │        │  Controller  │    │  Controller  │ │
│  └──────┬───────┘        └─────┬────────┘    └─────┬────────┘ │
│         │                      │                    │           │
│         └──────────────────────┼────────────────────┘           │
│                                │                                 │
│                     ┌──────────▼──────────┐                     │
│                     │    MIDDLEWARE       │                     │
│                     │  - Auth Protection  │                     │
│                     │  - Error Handling   │                     │
│                     │  - CORS             │                     │
│                     │  - JSON Parser      │                     │
│                     └──────────┬──────────┘                     │
│                                │                                 │
│                     ┌──────────▼──────────┐                     │
│                     │    USER MODEL       │                     │
│                     │  (Mongoose Schema)  │                     │
│                     │                     │                     │
│                     │  - name, email      │                     │
│                     │  - password (hash)  │                     │
│                     │  - subscription {}  │                     │
│                     │  - usage {}         │                     │
│                     └──────────┬──────────┘                     │
│                                │                                 │
└────────────────────────────────┼─────────────────────────────────┘
                                 │
                                 │ Mongoose ODM
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│                     DATABASE (MongoDB)                            │
│                   mongodb://localhost:27017                       │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  documentor Database                        │ │
│  │                                                             │ │
│  │  ┌────────────────────────────────────────────────────┐   │ │
│  │  │            users Collection                        │   │ │
│  │  │                                                     │   │ │
│  │  │  {                                                  │   │ │
│  │  │    _id: ObjectId,                                  │   │ │
│  │  │    name: "John Doe",                               │   │ │
│  │  │    email: "john@example.com",                      │   │ │
│  │  │    password: "$2a$10$hashed...",                   │   │ │
│  │  │    subscription: {                                  │   │ │
│  │  │      plan: "free|premium|team",                    │   │ │
│  │  │      status: "active|inactive|cancelled",          │   │ │
│  │  │      billingCycle: "monthly|annual",               │   │ │
│  │  │      amount: 0|19.99|49.99,                        │   │ │
│  │  │      stripeCustomerId: "cus_...",                  │   │ │
│  │  │      stripeSubscriptionId: "sub_..."               │   │ │
│  │  │    },                                               │   │ │
│  │  │    usage: {                                         │   │ │
│  │  │      documentsProcessed: 0,                        │   │ │
│  │  │      documentsThisMonth: 0,                        │   │ │
│  │  │      plagiarismChecksUsed: 0,                      │   │ │
│  │  │      storageUsed: 0                                │   │ │
│  │  │    },                                               │   │ │
│  │  │    createdAt: ISODate,                             │   │ │
│  │  │    updatedAt: ISODate                              │   │ │
│  │  │  }                                                  │   │ │
│  │  └────────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘


## Authentication Flow

┌────────┐                                      ┌─────────┐
│ User   │                                      │ Backend │
└───┬────┘                                      └────┬────┘
    │                                                │
    │  1. POST /api/auth/register                   │
    │  { name, email, password }                    │
    ├──────────────────────────────────────────────>│
    │                                                │
    │                          2. Hash password     │
    │                          3. Save to MongoDB   │
    │                          4. Generate JWT      │
    │                                                │
    │  5. Return { token, user }                    │
    │<──────────────────────────────────────────────┤
    │                                                │
    │  6. Store token in localStorage                │
    │                                                │
    │  7. POST /api/auth/login                      │
    │  { email, password }                          │
    ├──────────────────────────────────────────────>│
    │                                                │
    │                          8. Verify password   │
    │                          9. Generate JWT      │
    │                                                │
    │  10. Return { token, user }                   │
    │<──────────────────────────────────────────────┤
    │                                                │
    │  11. GET /api/auth/me                         │
    │  Headers: { Authorization: Bearer <token> }   │
    ├──────────────────────────────────────────────>│
    │                                                │
    │                          12. Verify JWT       │
    │                          13. Fetch user       │
    │                                                │
    │  14. Return { user }                          │
    │<──────────────────────────────────────────────┤
    │                                                │


## Subscription Management Flow

┌────────┐                                      ┌─────────┐
│ User   │                                      │ Backend │
└───┬────┘                                      └────┬────┘
    │                                                │
    │  1. GET /api/subscriptions/plans              │
    ├──────────────────────────────────────────────>│
    │                                                │
    │  2. Return [Free, Premium, Team]              │
    │<──────────────────────────────────────────────┤
    │                                                │
    │  3. Select Plan (e.g., Premium)               │
    │                                                │
    │  4. POST /api/subscriptions/create-checkout   │
    │  { plan: "premium", billingCycle: "monthly" } │
    ├──────────────────────────────────────────────>│
    │                                                │
    │                          5. Create Stripe     │
    │                             Checkout Session  │
    │                                                │
    │  6. Return { sessionId, url }                 │
    │<──────────────────────────────────────────────┤
    │                                                │
    │  7. Redirect to Stripe Checkout               │
    │                                                │
    │  ... User completes payment on Stripe ...     │
    │                                                │
    │  8. Stripe Webhook: checkout.session.complete │
    ├──────────────────────────────────────────────>│
    │                                                │
    │                          9. Update user       │
    │                             subscription in DB│
    │                                                │
    │  10. GET /api/subscriptions/current           │
    ├──────────────────────────────────────────────>│
    │                                                │
    │  11. Return { subscription, usage, limits }   │
    │<──────────────────────────────────────────────┤
    │                                                │


## Data Flow for Dashboard

Frontend Dashboard        API Service              Backend            MongoDB
      │                       │                      │                  │
      │ 1. Mount Dashboard    │                      │                  │
      │────────>              │                      │                  │
      │                       │                      │                  │
      │ 2. Fetch User Data    │                      │                  │
      │────────>              │                      │                  │
      │                       │ 3. GET /api/auth/me  │                  │
      │                       │─────────────────────>│                  │
      │                       │                      │ 4. Query User    │
      │                       │                      │─────────────────>│
      │                       │                      │ 5. Return User   │
      │                       │                      │<─────────────────│
      │                       │ 6. Return User Data  │                  │
      │                       │<─────────────────────│                  │
      │ 7. Update State       │                      │                  │
      │<────────              │                      │                  │
      │                       │                      │                  │
      │ 8. Fetch Subscription │                      │                  │
      │────────>              │                      │                  │
      │                       │ 9. GET /subscriptions│                  │
      │                       │─────────────────────>│                  │
      │                       │                      │ 10. Query User   │
      │                       │                      │─────────────────>│
      │                       │                      │ 11. Return Data  │
      │                       │                      │<─────────────────│
      │                       │ 12. Return Sub Data  │                  │
      │                       │<─────────────────────│                  │
      │ 13. Render Dashboard  │                      │                  │
      │<────────              │                      │                  │
      │                       │                      │                  │
      │ 14. Display:          │                      │                  │
      │     - Stats           │                      │                  │
      │     - Subscription    │                      │                  │
      │     - Usage Limits    │                      │                  │


## Security Layers

┌─────────────────────────────────────────────────────────────────┐
│                         Security Layers                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Layer 1: HTTPS/TLS                                              │
│  ├─ Encrypted data in transit                                    │
│  └─ SSL certificates (production)                                │
│                                                                   │
│  Layer 2: CORS                                                   │
│  ├─ Restrict origins                                             │
│  └─ Credentials handling                                         │
│                                                                   │
│  Layer 3: Authentication                                         │
│  ├─ JWT tokens (signed with secret)                             │
│  ├─ Token expiration (7 days)                                   │
│  └─ Bearer token in Authorization header                        │
│                                                                   │
│  Layer 4: Authorization                                          │
│  ├─ Protected routes middleware                                 │
│  ├─ Feature-based access control                                │
│  └─ Plan-based restrictions                                     │
│                                                                   │
│  Layer 5: Data Protection                                        │
│  ├─ Password hashing (bcrypt, 10 rounds)                        │
│  ├─ No password in responses                                    │
│  └─ Input validation & sanitization                             │
│                                                                   │
│  Layer 6: Database Security                                      │
│  ├─ Mongoose schema validation                                  │
│  ├─ Connection string in env vars                               │
│  └─ Indexed fields for performance                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘


## Future Architecture (Modules 1-9)

The current architecture will expand to include:

┌───────────────────────────────────────────────────────────────┐
│                    FUTURE COMPONENTS                           │
├───────────────────────────────────────────────────────────────┤
│                                                                 │
│  - Document Storage Service (AWS S3 / Local)                   │
│  - AI Processing Service (OpenAI API)                         │
│  - Plagiarism Detection Service (Copyleaks API)               │
│  - Citation Service (CrossRef API)                            │
│  - Export Service (DOCX, PDF, LaTeX generators)               │
│  - WebSocket Server (Real-time updates)                       │
│  - Email Service (Nodemailer with SMTP)                       │
│  - Notification System (In-app + Email)                       │
│  - Analytics Service (Usage tracking)                         │
│  - Cache Layer (Redis for performance)                        │
│                                                                 │
└───────────────────────────────────────────────────────────────┘

```

---

**This is your current system architecture! All layers are working and ready for expansion. 🎉**
