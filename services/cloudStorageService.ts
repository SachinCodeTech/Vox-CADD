
import { doc, setDoc, getDoc, serverTimestamp, collection, query, getDocs, deleteDoc } from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from './firebaseService';

interface DrawingData {
  layers: any;
  settings: any;
  blocks?: any;
  layouts?: any;
  fileName: string;
}

export const cloudStorageService = {
  /**
   * Saves a drawing to Firestore cloud storage
   */
  async saveToCloud(fileId: string, data: DrawingData): Promise<boolean> {
    if (!db || !auth?.currentUser) return false;

    const metadataPath = `users/${auth.currentUser.uid}/files/${fileId}`;
    const contentPath = `users/${auth.currentUser.uid}/drawings/${fileId}`;

    try {
      // 1. Save metadata
      await setDoc(doc(db, metadataPath), {
        fileName: data.fileName,
        fileSize: JSON.stringify(data).length,
        lastModified: serverTimestamp(),
        isSynced: true
      }, { merge: true });

      // 2. Save content
      const { layers, settings, blocks, layouts } = data;
      await setDoc(doc(db, contentPath), {
        layers,
        settings,
        blocks: blocks || {},
        layouts: layouts || [],
        fileName: data.fileName,
        lastModified: serverTimestamp()
      });

      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, contentPath);
      return false;
    }
  },

  /**
   * Loads a drawing from Firestore cloud storage
   */
  async loadFromCloud(fileId: string): Promise<DrawingData | null> {
    if (!db || !auth?.currentUser) return null;

    const path = `users/${auth.currentUser.uid}/drawings/${fileId}`;
    try {
      const snap = await getDoc(doc(db, path));
      if (snap.exists()) {
        return snap.data() as DrawingData;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  /**
   * Lists all cloud drawings for the current user
   */
  async listCloudFiles(): Promise<any[]> {
    if (!db || !auth?.currentUser) return [];

    const path = `users/${auth.currentUser.uid}/files`;
    try {
      const q = query(collection(db, path));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  /**
   * Deletes a drawing from the cloud
   */
  async deleteFromCloud(fileId: string): Promise<boolean> {
    if (!db || !auth?.currentUser) return false;

    const metadataPath = `users/${auth.currentUser.uid}/files/${fileId}`;
    const contentPath = `users/${auth.currentUser.uid}/drawings/${fileId}`;

    try {
      await deleteDoc(doc(db, metadataPath));
      await deleteDoc(doc(db, contentPath));
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, contentPath);
      return false;
    }
  }
};
