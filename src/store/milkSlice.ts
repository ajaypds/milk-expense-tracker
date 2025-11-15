import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { collection, addDoc, getDocs, query, where, doc, setDoc, orderBy, limit, startAfter as startAfterFn, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { MilkEntry } from '../types';
import { getPeriodDates, getMonthPeriod } from '../utils/dateUtils';

const USER_ID = 'defaultUser';
const entriesColRef = collection(db, 'users', USER_ID, 'milkEntries');
const periodsColRef = collection(db, 'users', USER_ID, 'billingPeriods');

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

// (local reducers are defined directly in createSlice)

// Thunk to fetch entries for a given month period (e.g., "2025-11")
export const fetchEntriesForPeriod = createAsyncThunk(
  'milk/fetchEntriesForPeriod',
  async (monthPeriod: string) => {
    const { startDate, endDate } = getPeriodDates(monthPeriod);
    const q = query(entriesColRef, where('date', '>=', startDate), where('date', '<=', endDate));
    const querySnapshot = await getDocs(q);
    // Debug: log how many docs were returned and their ids/dates (remove or silence in production)
    console.log(
      'fetchEntriesForPeriod',
      monthPeriod,
      'start',
      startDate,
      'end',
      endDate,
      'count',
      querySnapshot.size,
      'ids',
      querySnapshot.docs.map((d) => d.id),
      'dates',
      querySnapshot.docs.map((d) => ((d.data() as Record<string, unknown>).date))
    );

    let entries = querySnapshot.docs.map((doc) => {
      const d = doc.data() as Record<string, unknown>;
      // Normalize date field to YYYY-MM-DD string where possible
      let dateStr = '';
      const rawDate = d.date;
      if (typeof rawDate === 'string') dateStr = rawDate;
      else if (typeof rawDate === 'object' && rawDate && typeof (rawDate as { toDate?: unknown }).toDate === 'function') {
        dateStr = (rawDate as { toDate: () => Date }).toDate().toISOString().split('T')[0];
      } else if (rawDate != null) dateStr = String(rawDate);

      return {
        id: doc.id,
        date: dateStr,
        milkTaken: Boolean(d.milkTaken),
        quantity: typeof d.quantity === 'number' ? (d.quantity as number) : Number(d.quantity),
      } as MilkEntry;
    });

    // Fallback: if the query returned nothing, try a client-side filter to detect mismatched date types
    if (querySnapshot.empty) {
      console.warn('fetchEntriesForPeriod: no results from server-side query, running fallback client-side filter');
      const allSnapshot = await getDocs(entriesColRef);
      const fallback = allSnapshot.docs
        .map((d) => {
          const dd = d.data() as Record<string, unknown>;
          let dateStr = '';
          const rawDate = dd.date;
          if (typeof rawDate === 'string') dateStr = rawDate;
          else if (typeof rawDate === 'object' && rawDate && typeof (rawDate as { toDate?: unknown }).toDate === 'function') {
            dateStr = (rawDate as { toDate: () => Date }).toDate().toISOString().split('T')[0];
          } else if (rawDate != null) dateStr = String(rawDate);

          return {
            id: d.id,
            date: dateStr,
            milkTaken: Boolean(dd.milkTaken),
            quantity: typeof dd.quantity === 'number' ? (dd.quantity as number) : Number(dd.quantity),
          } as MilkEntry;
        })
        .filter((entry) => {
          const val = entry.date;
          if (!val) return false;
          return val >= startDate && val <= endDate;
        });

      console.log('fetchEntriesForPeriod fallback count', fallback.length, 'ids', fallback.map((f) => f.id));
      if (fallback.length) entries = fallback;
    }

    return entries;
  }
);

// Thunk to fetch all entries (no date filter)
export const fetchAllEntries = createAsyncThunk(
  'milk/fetchAllEntries',
  async () => {
    const querySnapshot = await getDocs(entriesColRef);
    console.log('fetchAllEntries count', querySnapshot.size, 'ids', querySnapshot.docs.map(d => d.id));
    const entries = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MilkEntry));
    return entries;
  }
);

// Thunk to fetch distinct billing periods metadata
export const fetchDistinctPeriods = createAsyncThunk(
  'milk/fetchDistinctPeriods',
  async () => {
    const snapshot = await getDocs(periodsColRef);
    const periods = snapshot.docs.map((d) => (d.data() as Record<string, unknown>).period as string).filter(Boolean);
    // sort descending
    return periods.sort((a, b) => (a < b ? 1 : -1));
  }
);

// Thunk to add or update a milk entry for a specific date
export const upsertMilkEntry = createAsyncThunk(
  'milk/upsertMilkEntry',
  async (entry: Omit<MilkEntry, 'id'>) => {
    // Check if an entry for the given date already exists
    // Compute billing period (YYYY-MM) from the entry date
    const bp = getMonthPeriod(new Date(entry.date));

    // Build stored object with billingPeriod
    const stored = { ...entry, billingPeriod: bp };

    const q = query(entriesColRef, where('date', '==', entry.date));
    const querySnapshot = await getDocs(q);

    let docId: string;
    if (querySnapshot.empty) {
      const docRef = await addDoc(entriesColRef, stored);
      docId = docRef.id;
    } else {
      const existingDocId = querySnapshot.docs[0].id;
      await setDoc(doc(db, 'users', USER_ID, 'milkEntries', existingDocId), stored);
      docId = existingDocId;
    }

    // Ensure billingPeriods metadata exists for this period
    try {
      await setDoc(doc(periodsColRef, bp), { period: bp, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.warn('Failed to write billingPeriods metadata', err);
    }

    return { id: docId, ...stored } as MilkEntry;
  }
);

// Paginated fetch for 'All' view - returns a page of entries ordered by date
export const fetchEntriesPage = createAsyncThunk(
  'milk/fetchEntriesPage',
  async (params: { pageSize?: number; startAfter?: string } = {}) => {
    const pageSize = params.pageSize ?? 20;
    const start = params.startAfter;
    let q;
    if (start) {
      q = query(entriesColRef, orderBy('date'), startAfterFn(start), limit(pageSize));
    } else {
      q = query(entriesColRef, orderBy('date'), limit(pageSize));
    }
    const querySnapshot = await getDocs(q);
    console.log('fetchEntriesPage count', querySnapshot.size, 'startAfter', start);
    const entries = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MilkEntry));
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
        // Append page results
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
        const existingIndex = state.entries.findIndex(e => e.date === newEntry.date);
        if (existingIndex !== -1) {
          state.entries[existingIndex] = newEntry;
        } else {
          // This logic might need to be smarter depending on what period is currently loaded
          // For now, we'll just add it if it's not a duplicate date.
          state.entries.push(newEntry);
        }
      });
  },
});

export const { clearEntries } = milkSlice.actions;

export default milkSlice.reducer;
