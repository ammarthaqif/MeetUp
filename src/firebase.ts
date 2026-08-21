import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

// Default configuration with safe fallback
let firebaseConfig: any = {
  projectId: "gen-lang-client-0129060777",
  appId: "1:365252719463:web:73eaa8ef18bf0bdc2af5c2",
  apiKey: "AIzaSyDGF93g0Lkz5QXpFAWNORQbxICBddVV3eU",
  authDomain: "gen-lang-client-0129060777.firebaseapp.com",
  storageBucket: "gen-lang-client-0129060777.firebasestorage.app",
  messagingSenderId: "365252719463"
};

if (
  firebaseConfigJson &&
  (firebaseConfigJson as any).apiKey &&
  typeof (firebaseConfigJson as any).apiKey === 'string' &&
  !(firebaseConfigJson as any).apiKey.startsWith('dummy') &&
  (firebaseConfigJson as any).projectId !== 'dummy-project-id'
) {
  firebaseConfig = firebaseConfigJson;
}

// Safely initialize Firebase app and services
let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

try {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else if (
    firebaseConfig &&
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.startsWith('dummy') &&
    firebaseConfig.projectId !== 'dummy-project-id'
  ) {
    app = initializeApp(firebaseConfig);
  }
  if (app) {
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
  }
} catch (error) {
  console.warn('Firebase initialization warning (falling back to local memory mode):', error);
}

export const auth = authInstance;
export const db = dbInstance;

// Configure Google Auth Provider with Google Calendar scopes
export const provider = new GoogleAuthProvider();
try {
  provider.addScope('https://www.googleapis.com/auth/calendar');
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
} catch (e) {
  console.warn('Provider scopes warning:', e);
}

// In-memory token storage (Do NOT persist to localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) {
        onAuthFailure();
      }
    }
  });
};

// Initiate Google Sign-In with Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!auth) {
    throw new Error('Firebase Auth is not available in offline preview mode.');
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve Google Calendar access token from auth result.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Retrieve token
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// Set token manually (e.g. if loaded via hook)
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

// Log out from application
export const logout = async () => {
  if (auth) {
    await auth.signOut();
  }
  cachedAccessToken = null;
};
