import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp, collection, query, getDocs } from 'firebase/firestore';
import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';
import firebaseConfigFile from '../firebase-applet-config.json';

// Use environment variables if available (Vite prefixed), otherwise fallback to the config file
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigFile.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigFile.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigFile.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigFile.authDomain,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigFile.firestoreDatabaseId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigFile.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigFile.messagingSenderId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigFile.measurementId,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

let analytics: any = null;

// Initialize analytics asynchronously and only if measurementId is provided
const initAnalytics = async () => {
  if (!firebaseConfig.measurementId) return;
  
  try {
    const supported = await isSupported();
    if (supported) {
      analytics = getAnalytics(app);
    }
  } catch (e) {
    console.warn("Firebase Analytics not initialized:", e);
  }
};
initAnalytics();

export const logAppEvent = (name: string, params?: any) => {
  if (analytics) {
    logEvent(analytics, name, params);
  }
};

/**
 * Syncs lightweight metadata to Firestore for the authenticated user.
 * This does NOT include any file content, only app state/settings.
 */
export const syncUserMetadata = async (metadata: { theme?: string; deviceInfo?: string }) => {
  const user = auth.currentUser;
  if (!user) return;

  const metadataRef = doc(db, 'users', user.uid, 'metadata', 'current');
  try {
    await setDoc(metadataRef, {
      ...metadata,
      uid: user.uid,
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
  const user = auth.currentUser;
  if (!user) return;

  const fileId = fileName.replace(/[^a-zA-Z0-9]/g, '_');
  const fileRef = doc(db, 'users', user.uid, 'files', fileId);
  
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
  return onAuthStateChanged(auth, callback);
};
