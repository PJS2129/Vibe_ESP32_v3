import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Check if firebase configuration is provided
const isFirebaseConfigured = !!(
  import.meta.env.VITE_FIREBASE_API_KEY?.trim() &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim()
);

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || 'placeholder-api-key').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'placeholder-auth-domain.firebaseapp.com').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || 'placeholder-project-id').trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'placeholder-storage-bucket.appspot.com').trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:placeholder').trim(),
};

if (!isFirebaseConfigured) {
  console.warn(
    "Firebase configuration is missing. Please add VITE_FIREBASE_* variables to your .env.local file."
  );
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export { auth, db, googleProvider, isFirebaseConfigured };

