import type { MilkEntry } from '../types';

const CACHE_KEY = 'milk_entries_cache';
const PENDING_QUEUE_KEY = 'milk_offline_pending_queue';

export const offlineSyncService = {
  /**
   * Save loaded entries to local storage for offline viewing
   */
  cacheEntries(entries: MilkEntry[]): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn('Failed to cache milk entries locally:', e);
    }
  },

  /**
   * Get cached entries when offline
   */
  getCachedEntries(): MilkEntry[] {
    try {
      const data = localStorage.getItem(CACHE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to read cached milk entries:', e);
      return [];
    }
  },

  /**
   * Queue a newly created or updated entry while offline
   */
  queuePendingEntry(entry: MilkEntry): void {
    try {
      const queue = this.getPendingQueue();
      // Replace existing pending entry for the same date if exists, or append
      const existingIdx = queue.findIndex((e) => e.date === entry.date);
      if (existingIdx !== -1) {
        queue[existingIdx] = entry;
      } else {
        queue.push(entry);
      }
      localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));

      // Also update local cache so the UI sees it immediately
      const cached = this.getCachedEntries();
      const cachedIdx = cached.findIndex((c) => c.date === entry.date);
      if (cachedIdx !== -1) {
        cached[cachedIdx] = entry;
      } else {
        cached.unshift(entry);
      }
      this.cacheEntries(cached);
    } catch (e) {
      console.warn('Failed to queue offline entry:', e);
    }
  },

  /**
   * Get all entries waiting to be synced to Supabase
   */
  getPendingQueue(): MilkEntry[] {
    try {
      const data = localStorage.getItem(PENDING_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to read pending offline queue:', e);
      return [];
    }
  },

  /**
   * Remove an entry from the pending queue after successful sync
   */
  removePendingEntry(date: string): void {
    try {
      const queue = this.getPendingQueue().filter((e) => e.date !== date);
      localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to remove pending entry:', e);
    }
  },

  /**
   * Check if user is currently online
   */
  isOnline(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;
  },
};
