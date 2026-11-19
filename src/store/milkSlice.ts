import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../supabase/client';
import type { MilkEntry } from '../types';
import { getMonthPeriod } from '../utils/dateUtils';
import { offlineSyncService } from '../services/offlineSyncService';

interface MilkState {
  entries: MilkEntry[];
  loading: boolean;
  error: string | null;
  distinctPeriods: string[];
  periodsLoading: boolean;
}

const initialState: MilkState = {
  entries: [],
  loading: false,
  error: null,
  distinctPeriods: [],
  periodsLoading: false,
};

// Thunk to fetch entries for a given month period (e.g., "2025-11")
export const fetchEntriesForPeriod = createAsyncThunk(
  'milk/fetchEntriesForPeriod',
  async (monthPeriod: string) => {
    if (!offlineSyncService.isOnline()) {
      const cached = offlineSyncService.getCachedEntries();
      return cached.filter((e) => {
        try {
          return getMonthPeriod(new Date(e.date)) === monthPeriod;
        } catch {
          return e.date.startsWith(monthPeriod);
        }
      });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    try {
      const { data, error } = await supabase
        .from('milk_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('billing_period', monthPeriod)
        .order('entry_date', { ascending: true });

      if (error) throw error;

      const entries = (data || []).map((d) => ({
        id: d.id,
        date: d.entry_date,
        milkTaken: Boolean(d.milk_taken),
        quantity: Number(d.quantity) || 0,
      })) as MilkEntry[];

      // Merge and update local cache
      const cached = offlineSyncService.getCachedEntries();
      const map = new Map<string, MilkEntry>();
      cached.forEach((e) => map.set(e.date, e));
      entries.forEach((e) => map.set(e.date, e));
      offlineSyncService.cacheEntries(Array.from(map.values()));

      return entries;
    } catch (err) {
      console.warn('Network error in fetchEntriesForPeriod, falling back to cache:', err);
      const cached = offlineSyncService.getCachedEntries();
      return cached.filter((e) => {
        try {
          return getMonthPeriod(new Date(e.date)) === monthPeriod;
        } catch {
          return e.date.startsWith(monthPeriod);
        }
      });
    }
  }
);

// Thunk to fetch all entries (no date filter)
export const fetchAllEntries = createAsyncThunk(
  'milk/fetchAllEntries',
  async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('milk_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: true });

    if (error) {
      console.error('fetchAllEntries error:', error);
      throw error;
    }

    const entries = (data || []).map((d) => ({
      id: d.id,
      date: d.entry_date,
      milkTaken: Boolean(d.milk_taken),
      quantity: Number(d.quantity) || 0,
    })) as MilkEntry[];

    return entries;
  }
);

// Thunk to fetch distinct billing periods metadata
export const fetchDistinctPeriods = createAsyncThunk(
  'milk/fetchDistinctPeriods',
  async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('billing_periods')
      .select('billing_period')
      .eq('user_id', user.id)
      .order('billing_period', { ascending: false });

    if (error) {
      console.error('fetchDistinctPeriods error:', error);
      throw error;
    }

    const periods = (data || [])
      .map((d) => d.billing_period as string)
      .filter(Boolean);

    return periods;
  }
);

// Thunk to add or update a milk entry for a specific date
export const upsertMilkEntry = createAsyncThunk(
  'milk/upsertMilkEntry',
  async (entry: Omit<MilkEntry, 'id'>) => {
    const optimisticEntry: MilkEntry = {
      id: entry.date,
      date: entry.date,
      milkTaken: Boolean(entry.milkTaken),
      quantity: entry.milkTaken ? Number(entry.quantity) || 0 : 0,
    };

    // If device is offline, immediately queue for sync and return optimistic entry
    if (!offlineSyncService.isOnline()) {
      offlineSyncService.queuePendingEntry(optimisticEntry);
      return optimisticEntry;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        offlineSyncService.queuePendingEntry(optimisticEntry);
        return optimisticEntry;
      }

      const bp = getMonthPeriod(new Date(entry.date));
      const stored = {
        user_id: user.id,
        entry_date: entry.date,
        milk_taken: Boolean(entry.milkTaken),
        quantity: entry.milkTaken ? Number(entry.quantity) || 0 : 0,
        billing_period: bp,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('milk_entries')
        .upsert(stored, { onConflict: 'user_id,entry_date' })
        .select()
        .single();

      if (error) throw error;

      // Clean from pending queue if previously queued
      offlineSyncService.removePendingEntry(entry.date);

      // Ensure billing_periods entry exists for this period
      try {
        await supabase.from('billing_periods').upsert(
          {
            user_id: user.id,
            billing_period: bp,
            payment_status: 'Unpaid',
          },
          { onConflict: 'user_id,billing_period', ignoreDuplicates: true }
        );
      } catch (err) {
        console.warn('Failed to ensure billing_periods row', err);
      }

      return {
        id: data.id,
        date: data.entry_date,
        milkTaken: Boolean(data.milk_taken),
        quantity: Number(data.quantity) || 0,
      } as MilkEntry;
    } catch (err) {
      console.warn('Offline / network error during upsertMilkEntry, queuing locally:', err);
      offlineSyncService.queuePendingEntry(optimisticEntry);
      return optimisticEntry;
    }
  }
);

// Thunk to sync any pending offline entries when connection is restored
export const syncPendingEntries = createAsyncThunk(
  'milk/syncPendingEntries',
  async () => {
    if (!offlineSyncService.isOnline()) return 0;
    const pending = offlineSyncService.getPendingQueue();
    if (pending.length === 0) return 0;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    let syncedCount = 0;
    for (const item of pending) {
      try {
        const bp = getMonthPeriod(new Date(item.date));
        const stored = {
          user_id: user.id,
          entry_date: item.date,
          milk_taken: Boolean(item.milkTaken),
          quantity: item.milkTaken ? Number(item.quantity) || 0 : 0,
          billing_period: bp,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('milk_entries')
          .upsert(stored, { onConflict: 'user_id,entry_date' });

        if (!error) {
          offlineSyncService.removePendingEntry(item.date);
          syncedCount++;
        }
      } catch (e) {
        console.warn('Error syncing pending item:', item.date, e);
      }
    }

    return syncedCount;
  }
);

// Paginated fetch for 'All' view - returns a page of entries ordered by date
export const fetchEntriesPage = createAsyncThunk(
  'milk/fetchEntriesPage',
  async (params: { pageSize?: number; startAfter?: string } = {}) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const pageSize = params.pageSize ?? 20;
    let query = supabase
      .from('milk_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: true })
      .limit(pageSize);

    if (params.startAfter) {
      query = query.gt('entry_date', params.startAfter);
    }

    const { data, error } = await query;
    if (error) throw error;

    const entries = (data || []).map((d) => ({
      id: d.id,
      date: d.entry_date,
      milkTaken: Boolean(d.milk_taken),
      quantity: Number(d.quantity) || 0,
    })) as MilkEntry[];

    const last = entries.length ? entries[entries.length - 1].date : null;
    return { entries, last } as { entries: MilkEntry[]; last: string | null };
  }
);

const milkSlice = createSlice({
  name: 'milk',
  initialState,
  reducers: {
    clearEntries(state: MilkState) {
      state.entries = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEntriesForPeriod.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllEntries.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEntriesForPeriod.fulfilled, (state, action: PayloadAction<MilkEntry[]>) => {
        state.entries = action.payload;
        state.loading = false;
      })
      .addCase(fetchEntriesPage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEntriesPage.fulfilled, (state, action: PayloadAction<{ entries: MilkEntry[]; last: string | null }>) => {
        state.entries = [...state.entries, ...action.payload.entries];
        state.loading = false;
      })
      .addCase(fetchEntriesPage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch entries';
      })
      .addCase(fetchDistinctPeriods.pending, (state) => {
        state.periodsLoading = true;
        state.error = null;
      })
      .addCase(fetchDistinctPeriods.fulfilled, (state, action: PayloadAction<string[]>) => {
        state.distinctPeriods = action.payload;
        state.periodsLoading = false;
      })
      .addCase(fetchDistinctPeriods.rejected, (state, action) => {
        state.periodsLoading = false;
        state.error = action.error.message || 'Failed to fetch periods';
      })
      .addCase(fetchAllEntries.fulfilled, (state, action: PayloadAction<MilkEntry[]>) => {
        state.entries = action.payload;
        state.loading = false;
      })
      .addCase(fetchEntriesForPeriod.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch entries';
      })
      .addCase(fetchAllEntries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch entries';
      })
      .addCase(upsertMilkEntry.fulfilled, (state, action: PayloadAction<MilkEntry>) => {
        const newEntry = action.payload;
        const existingIndex = state.entries.findIndex((e) => e.date === newEntry.date);
        if (existingIndex !== -1) {
          state.entries[existingIndex] = newEntry;
        } else {
          state.entries.push(newEntry);
        }
      });
  },
});

export const { clearEntries } = milkSlice.actions;
export default milkSlice.reducer;
