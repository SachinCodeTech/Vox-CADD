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
  }
};
