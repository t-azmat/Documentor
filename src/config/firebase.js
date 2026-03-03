import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

// Your Firebase configuration - FREE TIER (Spark Plan)
// Based on your project: documentor-3f926
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // Get from Firebase Console → Project Settings → General → Your apps
  authDomain: "documentor-3f926.firebaseapp.com",
  projectId: "documentor-3f926",
  storageBucket: "documentor-3f926.appspot.com",
  messagingSenderId: "968728801426",
  appId: "YOUR_APP_ID" // Get from Firebase Console → Project Settings → General → Your apps
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)

export default app
