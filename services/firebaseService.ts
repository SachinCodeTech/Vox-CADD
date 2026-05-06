import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import { getAnalytics, logEvent, isSupported, Analytics } from 'firebase/analytics';

// Attempt to get config from env vars
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

// Check if we have at least a projectId and apiKey to initialize
const isFirebaseEnabled = !!(firebaseConfig.projectId && firebaseConfig.apiKey);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let analytics: Analytics | null = null;

if (isFirebaseEnabled) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined);

    // Initialize analytics asynchronously
    isSupported().then(supported => {
        if (supported && app) {
            analytics = getAnalytics(app);
        }
    }).catch(() => {});
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
}

export { auth, db };

export const logAppEvent = (name: string, params?: any) => {
  if (analytics) {
    logEvent(analytics, name, params);
  }
};

/**
 * Syncs lightweight metadata to Firestore for the authenticated user.
 */
export const syncUserMetadata = async (metadata: { theme?: string; deviceInfo?: string }) => {
  if (!db || !auth || !auth.currentUser) return;

  const metadataRef = doc(db, 'users', auth.currentUser.uid, 'metadata', 'current');
  try {
    await setDoc(metadataRef, {
      ...metadata,
      uid: auth.currentUser.uid,
      lastModified: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Firebase Sync Error (Metadata):", error);
  }
};

/**
 * Optional: Syncs metadata about a local file (no file content).
 */
export const trackFileMetadata = async (fileName: string, fileSize: number) => {
  if (!db || !auth || !auth.currentUser) return;

  const fileId = fileName.replace(/[^a-zA-Z0-9]/g, '_');
  const fileRef = doc(db, 'users', auth.currentUser.uid, 'files', fileId);
  
  try {
    await setDoc(fileRef, {
      fileName,
      fileSize,
      lastModified: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Firebase Sync Error (File Metadata):", error);
  }
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  if (auth) {
    return onAuthStateChanged(auth, callback);
  }
  return () => {}; // return no-op
};
