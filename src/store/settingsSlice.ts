import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../supabase/client';
import type { Settings } from '../types';

interface SettingsState {
  settings: Settings;
  loading: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  settings: {
    milkRate: 55, // Default rate
    paymentStatus: {},
  },
  loading: false,
  error: null,
};

// Async thunk to fetch settings from Supabase
export const fetchSettings = createAsyncThunk('settings/fetchSettings', async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch the latest active milk rate
  const { data: rateData, error: rateError } = await supabase
    .from('milk_rates')
    .select('rate')
    .eq('user_id', user.id)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rateError) console.warn('Error fetching milk rate:', rateError);

  const milkRate = rateData ? Number(rateData.rate) : 55;

  // Fetch all billing period payment statuses
  const { data: periodsData, error: periodsError } = await supabase
    .from('billing_periods')
    .select('billing_period, payment_status')
    .eq('user_id', user.id);

  if (periodsError) console.warn('Error fetching billing periods:', periodsError);

  const paymentStatus: Record<string, 'Paid' | 'Unpaid'> = {};
  (periodsData || []).forEach((p) => {
    paymentStatus[p.billing_period] = (p.payment_status as 'Paid' | 'Unpaid') || 'Unpaid';
  });

  return {
    milkRate,
    paymentStatus,
  } as Settings;
});

// Async thunk to update settings in Supabase
export const updateSettings = createAsyncThunk(
  'settings/updateSettings',
  async (newSettings: Partial<Settings>, { getState }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const state = getState() as { settings: SettingsState };
    const currentSettings = state.settings.settings;
    const updatedSettings: Settings = { ...currentSettings, ...newSettings };

    // 1. If milkRate is provided and changed, record in milk_rates
    if (newSettings.milkRate !== undefined && newSettings.milkRate !== currentSettings.milkRate) {
      const today = new Date().toISOString().split('T')[0];
      const { error: rateError } = await supabase.from('milk_rates').upsert(
        {
          user_id: user.id,
          rate: Number(newSettings.milkRate),
          effective_from: today,
        },
        { onConflict: 'user_id,effective_from' }
      );
      if (rateError) console.error('Failed to update milk_rates:', rateError);
    }

    // 2. If paymentStatus is provided, update billing_periods
    if (newSettings.paymentStatus) {
      for (const [period, status] of Object.entries(newSettings.paymentStatus)) {
        if (currentSettings.paymentStatus[period] !== status) {
          const isPaid = status === 'Paid';
          const { error: bpError } = await supabase.from('billing_periods').upsert(
            {
              user_id: user.id,
              billing_period: period,
              payment_status: status,
              paid_at: isPaid ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,billing_period' }
          );
          if (bpError) console.error(`Failed to update billing period ${period}:`, bpError);
        }
      }
    }

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
