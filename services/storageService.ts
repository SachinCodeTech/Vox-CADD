import { get, set, del } from 'idb-keyval';

const STORAGE_PREFIX = 'voxcadd_';
const ACTIVE_WORKSPACE_KEY = 'voxcadd_active_workspace';

export const storageService = {
  /**
   * Saves large data objects to IndexedDB
   */
  async saveLarge(key: string, data: any): Promise<boolean> {
    try {
      await set(key, data);
      return true;
    } catch (err) {
      console.error('FAILED_TO_SAVE_TO_INDEXEDDB:', err);
      return false;
    }
  },

  /**
   * Loads large data from IndexedDB
   */
  async loadLarge<T>(key: string): Promise<T | null> {
    try {
      return await get(key) || null;
    } catch (err) {
      console.error('FAILED_TO_LOAD_FROM_INDEXEDDB:', err);
      return null;
    }
  },

  /**
   * Deletes large data from IndexedDB
   */
  async deleteLarge(key: string): Promise<boolean> {
    try {
      await del(key);
      return true;
    } catch (err) {
      console.error('FAILED_TO_DELETE_FROM_INDEXEDDB:', err);
      return false;
    }
  },

  /**
   * Rename/Move large data in IndexedDB
   */
  async renameLarge(oldKey: string, newKey: string): Promise<boolean> {
    try {
      const data = await this.loadLarge(oldKey);
      if (data) {
        await this.saveLarge(newKey, data);
        await this.deleteLarge(oldKey);
        return true;
      }
      return false;
    } catch (err) {
      console.error('FAILED_TO_RENAME_IN_INDEXEDDB:', err);
      return false;
    }
  },

  /**
   * Saves the active workspace
   */
  async saveActiveWorkspace(data: any): Promise<boolean> {
    return this.saveLarge(ACTIVE_WORKSPACE_KEY, data);
  },

  /**
   * Loads the active workspace.
   * Falls back to localStorage for legacy migrations.
   */
  async loadActiveWorkspace(): Promise<any | null> {
    let data = await this.loadLarge(ACTIVE_WORKSPACE_KEY);
    
    // Legacy migration fallback
    if (!data) {
      const legacyData = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
      if (legacyData) {
        try {
          data = JSON.parse(legacyData);
          // Migrate to IndexedDB
          await this.saveActiveWorkspace(data);
          // Cleanup legacy
          localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
          console.log('MIGRATED_LEGACY_WORKSPACE_TO_INDEXEDDB');
        } catch (e) {
          console.error('LEGACY_PARSE_ERROR', e);
        }
      }
    }
    
    return data;
  },

  /**
   * Save app settings (small, good for localStorage)
   */
  saveSettings(key: string, data: any) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
    } catch (e) {
      console.warn('LOCALSTORAGE_FULL_FOR_SETTINGS', e);
    }
  },

  /**
   * Load app settings
   */
  loadSettings<T>(key: string): T | null {
    const val = localStorage.getItem(STORAGE_PREFIX + key);
    if (!val) return null;
    try {
      return JSON.parse(val) as T;
    } catch {
      return null;
    }
  },

  /**
   * Pushes a snapshot of commands/changes executed offline into IndexedDB queue
   */
  async pushOfflineCommand(fileName: string, layers: any, layouts: any, blocks: any): Promise<void> {
    try {
      const key = `offline_queue_${fileName}`;
      const existingQueue: any[] = await this.loadLarge(key) || [];
      const item = {
        id: Math.random().toString(36).substr(2, 9),
        fileName,
        timestamp: Date.now(),
        layers,
        layouts,
        blocks
      };
      existingQueue.push(item);
      // Keep only last 20 operations to avoid bloating memory/disk limits
      if (existingQueue.length > 20) {
        existingQueue.shift();
      }
      await this.saveLarge(key, existingQueue);
      console.log(`OFFLINE_QUEUE_PUSHED: ${fileName} (Queue length: ${existingQueue.length})`);
    } catch (err) {
      console.error('FAILED_TO_PUSH_OFFLINE_COMMAND:', err);
    }
  },

  /**
   * Retrieves the offline command snaps for a given file name
   */
  async getOfflineQueue(fileName: string): Promise<any[]> {
    try {
      const key = `offline_queue_${fileName}`;
      return await this.loadLarge(key) || [];
    } catch (err) {
      console.error('FAILED_TO_GET_OFFLINE_QUEUE:', err);
      return [];
    }
  },

  /**
   * Cleans up the offline queue for a given file name upon successful sync
   */
  async clearOfflineQueue(fileName: string): Promise<void> {
    try {
      const key = `offline_queue_${fileName}`;
      await this.deleteLarge(key);
      console.log(`OFFLINE_QUEUE_CLEARED: ${fileName}`);
    } catch (err) {
      console.error('FAILED_TO_CLEAR_OFFLINE_QUEUE:', err);
    }
  }
};
