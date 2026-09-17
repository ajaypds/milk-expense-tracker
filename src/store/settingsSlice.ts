import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../supabase/client';
import type { Settings, MilkRateHistory } from '../types';

interface SettingsState {
  settings: Settings;
  loading: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  settings: {
    milkRate: 55, // Default rate
    effectiveFrom: '2020-01-01',
    rateHistory: [],
    cycleStartDay: 10,
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

  // 1. Fetch user preferences
  const { data: userSettingsData } = await supabase
    .from('user_settings')
    .select('cycle_start_day')
    .eq('user_id', user.id)
    .maybeSingle();

  const cycleStartDay = userSettingsData?.cycle_start_day ?? 10;

  // 2. Fetch full rate history ordered descending
  const { data: rateHistoryData, error: rateError } = await supabase
    .from('milk_rates')
    .select('*')
    .eq('user_id', user.id)
    .order('effective_from', { ascending: false });

  if (rateError) console.warn('Error fetching milk rates:', rateError);

  const rateHistory: MilkRateHistory[] = (rateHistoryData || []).map((r) => ({
    id: r.id,
    rate: Number(r.rate),
    effective_from: r.effective_from,
    created_at: r.created_at,
  }));

  const activeRate = rateHistory.length > 0 ? rateHistory[0].rate : 55;
  const activeEffectiveFrom = rateHistory.length > 0 ? rateHistory[0].effective_from : '2020-01-01';

  // 3. Fetch all billing period payment statuses
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
    milkRate: activeRate,
    effectiveFrom: activeEffectiveFrom,
    rateHistory,
    cycleStartDay,
    paymentStatus,
  } as Settings;
});

// Async thunk to add a new versioned milk rate with effective_from date
export const addMilkRate = createAsyncThunk(
  'settings/addMilkRate',
  async ({ rate, effectiveFrom }: { rate: number; effectiveFrom: string }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('milk_rates')
      .upsert(
        {
          user_id: user.id,
          rate,
          effective_from: effectiveFrom,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,effective_from' }
      )
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      rate: Number(data.rate),
      effective_from: data.effective_from,
      created_at: data.created_at,
    } as MilkRateHistory;
  }
);

// Async thunk to update billing cycle start day
export const updateCycleStartDay = createAsyncThunk(
  'settings/updateCycleStartDay',
  async (cycleStartDay: number) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      cycle_start_day: cycleStartDay,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    return cycleStartDay;
  }
);

// Async thunk to update settings / payment status in Supabase
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

    // If paymentStatus is updated, persist in billing_periods
    if (newSettings.paymentStatus) {
      for (const [period, status] of Object.entries(newSettings.paymentStatus)) {
        if (currentSettings.paymentStatus[period] !== status) {
          const isPaid = status === 'Paid';
          
          // If marking as paid, freeze effective rate
          const updatePayload: Record<string, unknown> = {
            user_id: user.id,
            billing_period: period,
            payment_status: status,
            paid_at: isPaid ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          };

          if (isPaid) {
            updatePayload.effective_rate = currentSettings.milkRate;
          }

          const { error: bpError } = await supabase.from('billing_periods').upsert(
            updatePayload,
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
    setPaymentStatus: (
      state,
      action: PayloadAction<{ monthPeriod: string; status: 'Paid' | 'Unpaid' }>
    ) => {
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
      .addCase(addMilkRate.fulfilled, (state, action: PayloadAction<MilkRateHistory>) => {
        const newRate = action.payload;
        // Prepend to rate history
        const existingIdx = (state.settings.rateHistory || []).findIndex(
          (r) => r.effective_from === newRate.effective_from
        );
        if (existingIdx !== -1) {
          state.settings.rateHistory![existingIdx] = newRate;
        } else {
          state.settings.rateHistory = [newRate, ...(state.settings.rateHistory || [])].sort(
            (a, b) => (a.effective_from < b.effective_from ? 1 : -1)
          );
        }
        // If this rate is newer or equal to today, update active milkRate
        if (state.settings.rateHistory && state.settings.rateHistory.length > 0) {
          state.settings.milkRate = state.settings.rateHistory[0].rate;
          state.settings.effectiveFrom = state.settings.rateHistory[0].effective_from;
        }
      })
      .addCase(updateCycleStartDay.fulfilled, (state, action: PayloadAction<number>) => {
        state.settings.cycleStartDay = action.payload;
      })
      .addCase(updateSettings.fulfilled, (state, action: PayloadAction<Settings>) => {
        state.settings = action.payload;
      });
  },
});

export const { setMilkRate, setPaymentStatus } = settingsSlice.actions;
export default settingsSlice.reducer;
