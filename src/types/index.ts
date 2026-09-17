export interface MilkEntry {
  id?: string;
  date: string; // Stored as ISO string (e.g., "2025-11-12")
  milkTaken: boolean;
  quantity: number; // in liters (0, 0.5, 1, 1.5, 2)
}

export interface MilkRateHistory {
  id: string;
  rate: number;
  effective_from: string; // "YYYY-MM-DD"
  created_at?: string;
}

export interface PaidMonthReport {
  id: string;
  billingPeriod: string; // e.g., "2026-09"
  paymentStatus: 'Paid' | 'Unpaid';
  totalLiters: number;
  effectiveRate: number; // Snapshot of rate when marked as Paid
  totalAmount: number;
  paidAt: string | null;
  notes?: string | null;
}

export interface UserSettings {
  cycleStartDay: number;
  vendorName?: string;
  vendorUpiId?: string;
  vendorPhone?: string;
  dailyReminderEnabled?: boolean;
  dailyReminderTime?: string;
}

export interface PaymentLedgerEntry {
  id?: string;
  billingPeriod: string;
  amountPaid: number;
  advanceBalance: number;
  paymentMethod: string;
  createdAt?: string;
}

export interface Settings {
  milkRate: number; // current active rate
  effectiveFrom?: string; // date current rate became active
  rateHistory?: MilkRateHistory[];
  cycleStartDay?: number;
  vendorName?: string;
  vendorUpiId?: string;
  vendorPhone?: string;
  advanceBalance?: number;
  paymentStatus: {
    [monthPeriod: string]: 'Paid' | 'Unpaid'; // e.g., { "2025-11": "Paid" }
  };
}

export interface MonthlySummary {
  totalQuantity: number;
  totalAmount: number;
  monthPeriod: string; // e.g., "2025-11"
  paymentStatus: 'Paid' | 'Unpaid';
}
