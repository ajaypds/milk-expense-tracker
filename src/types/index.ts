export interface MilkEntry {
  id?: string;
  date: string; // Stored as ISO string (e.g., "2025-11-12")
  milkTaken: boolean;
  quantity: number; // in liters (0, 0.5, 1, 1.5, 2)
}

export interface Settings {
  milkRate: number; // rupees per liter
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
