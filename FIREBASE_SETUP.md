# Firebase Free Tier Setup Guide

## Important: This project works with Firebase FREE TIER (Spark Plan)

You don't need to add any payment method or upgrade to Blaze plan. Follow these steps:

## Step 1: Create Firebase Project (FREE)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter project name (e.g., "documentor-app")
4. **IMPORTANT**: When asked about billing, select **"Spark Plan" (FREE)**
5. Disable Google Analytics (optional, saves quota)
6. Click "Create project"

## Step 2: Enable Services (All FREE)

### Enable Firestore Database
1. In Firebase Console, go to "Build" → "Firestore Database"
2. Click "Create database"
3. Select "Start in test mode" (for development)
4. Choose a location closest to you
5. Click "Enable"

**Free Tier Limits:**
- 1 GB storage
- 50K reads/day
- 20K writes/day
- 20K deletes/day

### Enable Authentication
1. Go to "Build" → "Authentication"
2. Click "Get started"
3. Enable "Email/Password" under Sign-in methods

**Free Tier:** Unlimited users

### Enable Storage (Optional)
1. Go to "Build" → "Storage"
2. Click "Get started"
3. Start in test mode

**Free Tier:** 5 GB storage, 1 GB/day download

## Step 3: Get Your Config

1. Go to Project Settings (gear icon)
2. Scroll to "Your apps"
3. Click the web icon `</>`
4. Register your app (name: "Documentor Web")
5. Copy the `firebaseConfig` object

## Step 4: Add Config to Your App

Open `src/config/firebase.js` and replace with your config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
}
```

## Step 5: Set Firestore Security Rules

In Firestore Database → Rules, paste this for development:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**For production, use proper authentication rules.**

## Collections Used (Auto-created)

The app will automatically create these collections:
- `styleTemplates` - Style guide templates
- `systemLogs` - System activity logs  
- `users` - User data and roles

## Free Tier is Enough For:

✅ Development and testing
✅ Small to medium projects (up to 100-200 daily active users)
✅ All features in this app
✅ No credit card required

## When You Might Need Blaze (Pay-as-you-go):

- More than 50K document reads per day
- Need Cloud Functions
- Need Firebase Hosting
- Large file storage needs

**But you can start and test everything with FREE tier!**

## Troubleshooting

**If Firebase asks for billing:**
- You may have accidentally selected Blaze plan
- Create a new project and select "Spark Plan"
- Check project billing in Settings → Usage and billing → Details

**Storage/quota errors:**
- Monitor usage in Console → Usage tab
- Optimize queries to reduce reads
- Use pagination for large lists

## Quick Start After Setup

1. Add your Firebase config to `src/config/firebase.js`
2. Run `npm run dev` to start the app
3. Navigate to `/admin` after login
4. Start adding style templates!

Your data stays in Firebase's free tier unless you manually upgrade.
