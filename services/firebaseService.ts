import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User, Auth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, Firestore, getDocFromServer } from 'firebase/firestore';
import { getAnalytics, logEvent, isSupported, Analytics } from 'firebase/analytics';

// @ts-ignore
import firebaseConfig from '../firebase-applet-config.json';

// --- Types ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

// --- Initialization ---

let app: FirebaseApp | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;
let analytics: Analytics | null = null;

const initializeFirebase = () => {
    if (app) return { app, auth, db };
    
    // Check if config exists and has valid values - if not, we can't init
    const isValidConfig = firebaseConfig && 
                         firebaseConfig.apiKey && 
                         firebaseConfig.projectId && 
                         firebaseConfig.apiKey !== "" && 
                         firebaseConfig.projectId !== "";

    if (!isValidConfig) {
        console.warn("Firebase is not fully configured. Please use the Firebase setup tool in the platform UI.");
        return { app: null, auth: null, db: null };
    }

    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
        
        isSupported().then(supported => {
            if (supported && app) {
                analytics = getAnalytics(app);
            }
        }).catch(() => {});

        // Test connection
        testConnection();
    } catch (e) {
        console.error("Firebase Initialization Error:", e);
    }
    
    return { app, auth, db };
};

async function testConnection() {
  const { db } = initializeFirebase();
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client is offline. Operations will be queued.");
    }
  }
}

// --- Error Handling ---

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const { auth } = initializeFirebase();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  const stringifiedError = JSON.stringify(errInfo);
  console.error('Firestore Error: ', stringifiedError);
  throw new Error(stringifiedError);
}

// --- Auth Operations ---

export const loginWithGoogle = async () => {
    const { auth } = initializeFirebase();
    if (!auth) {
        throw new Error("Firebase is not configured. Please set up Firebase in the platform settings or accept the storage terms if prompted.");
    }
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error: any) {
        // Handle specific "user cancelled" error separately to avoid scary console errors
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            console.log("Login popup closed or cancelled by user selection.");
        } else {
            console.error("Login Error:", error);
        }
        throw error;
    }
};

export const logout = async () => {
    const { auth } = initializeFirebase();
    if (auth) await signOut(auth);
};

// --- Business Logic ---

const { auth: initializedAuth, db: initializedDb } = initializeFirebase();
auth = initializedAuth;
db = initializedDb;

export const logAppEvent = (name: string, params?: any) => {
  if (!analytics) initializeFirebase();
  if (analytics) {
    logEvent(analytics, name, params);
  }
};

/**
 * Syncs lightweight metadata to Firestore for the authenticated user.
 */
export const syncUserMetadata = async (metadata: { theme?: string; deviceInfo?: string }) => {
  const { db, auth } = initializeFirebase();
  if (!db || !auth || !auth.currentUser) return;

  const path = `users/${auth.currentUser.uid}/metadata/current`;
  const metadataRef = doc(db, path);
  try {
    await setDoc(metadataRef, {
      ...metadata,
      uid: auth.currentUser.uid,
      lastModified: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

/**
 * Syncs metadata about a CAD file.
 */
export const trackFileMetadata = async (fileName: string, fileSize: number) => {
  const { db, auth } = initializeFirebase();
  if (!db || !auth || !auth.currentUser) return;

  const fileId = fileName.replace(/[^a-zA-Z0-9]/g, '_');
  const path = `users/${auth.currentUser.uid}/files/${fileId}`;
  const fileRef = doc(db, path);
  
  try {
    await setDoc(fileRef, {
      fileName,
      fileSize,
      lastModified: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  const { auth } = initializeFirebase();
  if (auth) {
    return onAuthStateChanged(auth, callback);
  }
  return () => {}; // return no-op
};
