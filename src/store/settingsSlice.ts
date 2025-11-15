import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Settings } from '../types';

// Hardcoded user ID for simplicity. In a real app, this would come from auth.
const USER_ID = 'defaultUser';
const settingsDocRef = doc(db, 'users', USER_ID, 'settings', 'appSettings');

interface SettingsState {
  settings: Settings;
  loading: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  settings: {
    milkRate: 60, // Default rate
    paymentStatus: {},
  },
  loading: false,
  error: null,
};

// Async thunk to fetch settings from Firestore
export const fetchSettings = createAsyncThunk('settings/fetchSettings', async () => {
  const docSnap = await getDoc(settingsDocRef);
  if (docSnap.exists()) {
    return docSnap.data() as Settings;
  } else {
    // If no settings exist, create them with initial state
    await setDoc(settingsDocRef, initialState.settings);
    return initialState.settings;
  }
});

// Async thunk to update the entire settings object in Firestore
export const updateSettings = createAsyncThunk(
  'settings/updateSettings',
  async (newSettings: Partial<Settings>, { getState }) => {
    const state = getState() as { settings: SettingsState };
    const currentSettings = state.settings.settings;
    const updatedSettings = { ...currentSettings, ...newSettings };
    await setDoc(settingsDocRef, updatedSettings, { merge: true });
    return updatedSettings;
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setMilkRate: (state, action: PayloadAction<number>) => {
      state.settings.milkRate = action.payload;
    },
    setPaymentStatus: (state, action: PayloadAction<{ monthPeriod: string; status: 'Paid' | 'Unpaid' }>) => {
      const { monthPeriod, status } = action.payload;
      state.settings.paymentStatus[monthPeriod] = status;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action: PayloadAction<Settings>) => {
        state.settings = action.payload;
        state.loading = false;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch settings';
      })
      .addCase(updateSettings.fulfilled, (state, action: PayloadAction<Settings>) => {
        state.settings = action.payload;
      });
  },
});

export const { setMilkRate, setPaymentStatus } = settingsSlice.actions;
export default settingsSlice.reducer;
