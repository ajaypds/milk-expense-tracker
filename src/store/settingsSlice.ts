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
    vendorName: '',
    vendorUpiId: '',
    vendorPhone: '',
    advanceBalance: 0,
    dailyReminderEnabled: true,
    dailyReminderTime: '20:30',
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

  // 1. Fetch user preferences & vendor details
  const { data: userSettingsData } = await supabase
    .from('user_settings')
    .select('cycle_start_day, vendor_name, vendor_upi_id, vendor_phone, daily_reminder_enabled, daily_reminder_time')
    .eq('user_id', user.id)
    .maybeSingle();

  const cycleStartDay = userSettingsData?.cycle_start_day ?? 10;
  const vendorName = userSettingsData?.vendor_name ?? '';
  const vendorUpiId = userSettingsData?.vendor_upi_id ?? '';
  const vendorPhone = userSettingsData?.vendor_phone ?? '';
  const dailyReminderEnabled = userSettingsData?.daily_reminder_enabled ?? true;
  const rawReminderTime = userSettingsData?.daily_reminder_time;
  const dailyReminderTime = rawReminderTime ? String(rawReminderTime).slice(0, 5) : '20:30';

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

  // 3. Fetch latest advance balance from payment_ledger
  const { data: ledgerData } = await supabase
    .from('payment_ledger')
    .select('advance_balance')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const advanceBalance = ledgerData?.advance_balance ? Number(ledgerData.advance_balance) : 0;

  // 4. Fetch all billing period payment statuses
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
    vendorName,
    vendorUpiId,
    vendorPhone,
    advanceBalance,
    dailyReminderEnabled,
    dailyReminderTime,
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

// Async thunk to update vendor information (UPI, phone, name)
export const updateVendorSettings = createAsyncThunk(
  'settings/updateVendorSettings',
  async (vendorInfo: { vendorName?: string; vendorUpiId?: string; vendorPhone?: string }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      vendor_name: vendorInfo.vendorName,
      vendor_upi_id: vendorInfo.vendorUpiId,
      vendor_phone: vendorInfo.vendorPhone,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    return vendorInfo;
  }
);

// Async thunk to update daily reminder preferences
export const updateReminderSettings = createAsyncThunk(
  'settings/updateReminderSettings',
  async ({ enabled, time }: { enabled: boolean; time: string }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const formattedTime = time.length === 5 ? `${time}:00` : time;

    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      daily_reminder_enabled: enabled,
      daily_reminder_time: formattedTime,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    return { enabled, time: formattedTime.slice(0, 5) };
  }
);

// Async thunk to record payment with advance/carryover ledger
export const recordPaymentWithLedger = createAsyncThunk(
  'settings/recordPaymentWithLedger',
  async (payload: {
    billingPeriod: string;
    amountDue: number;
    amountPaid: number;
    effectiveRate: number;
    paymentMethod?: string;
    notes?: string;
  }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const advanceBalance = Number((payload.amountPaid - payload.amountDue).toFixed(2));

    // 1. Insert into payment_ledger
    const { error: ledgerError } = await supabase.from('payment_ledger').insert({
      user_id: user.id,
      billing_period: payload.billingPeriod,
      amount_paid: payload.amountPaid,
      advance_balance: advanceBalance,
      payment_method: payload.paymentMethod || 'UPI',
      created_at: new Date().toISOString(),
    });
    if (ledgerError) console.error('Ledger error:', ledgerError);

    // 2. Update billing_periods
    const { error: bpError } = await supabase.from('billing_periods').upsert(
      {
        user_id: user.id,
        billing_period: payload.billingPeriod,
        payment_status: 'Paid',
        effective_rate: payload.effectiveRate,
        total_amount: payload.amountDue,
        paid_at: new Date().toISOString(),
        notes: payload.notes || (advanceBalance !== 0 ? `Paid: ₹${payload.amountPaid} (Advance: ₹${advanceBalance})` : undefined),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,billing_period' }
    );
    if (bpError) throw bpError;

    return {
      billingPeriod: payload.billingPeriod,
      advanceBalance,
    };
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
        if (state.settings.rateHistory && state.settings.rateHistory.length > 0) {
          state.settings.milkRate = state.settings.rateHistory[0].rate;
          state.settings.effectiveFrom = state.settings.rateHistory[0].effective_from;
        }
      })
      .addCase(updateCycleStartDay.fulfilled, (state, action: PayloadAction<number>) => {
        state.settings.cycleStartDay = action.payload;
      })
      .addCase(updateVendorSettings.fulfilled, (state, action) => {
        if (action.payload.vendorName !== undefined) state.settings.vendorName = action.payload.vendorName;
        if (action.payload.vendorUpiId !== undefined) state.settings.vendorUpiId = action.payload.vendorUpiId;
        if (action.payload.vendorPhone !== undefined) state.settings.vendorPhone = action.payload.vendorPhone;
      })
      .addCase(updateReminderSettings.fulfilled, (state, action) => {
        state.settings.dailyReminderEnabled = action.payload.enabled;
        state.settings.dailyReminderTime = action.payload.time;
      })
      .addCase(recordPaymentWithLedger.fulfilled, (state, action) => {
        state.settings.paymentStatus[action.payload.billingPeriod] = 'Paid';
        state.settings.advanceBalance = action.payload.advanceBalance;
      })
      .addCase(updateSettings.fulfilled, (state, action: PayloadAction<Settings>) => {
        state.settings = action.payload;
      });
  },
});

export const { setMilkRate, setPaymentStatus } = settingsSlice.actions;
export default settingsSlice.reducer;
