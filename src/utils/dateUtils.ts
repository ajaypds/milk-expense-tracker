/**
 * Calculates the billing period string (e.g., "2025-11") for a given date.
 * The period runs from the 10th of the previous month to the 9th of the current month.
 * @param date The date for which to determine the billing period.
 * @returns The billing period as a "YYYY-MM" string.
 */
export const getMonthPeriod = (date: Date): string => {
  const year = date.getFullYear();
  const month0 = date.getMonth(); // 0-indexed (0 for Jan)
  const dayOfMonth = date.getDate();

  // Billing window: 10th (inclusive) of previous month -> 9th (inclusive) of current month.
  // For a given calendar date, if day >= 10 the billing period is the NEXT calendar month.
  // If day <= 9 the billing period is the CURRENT calendar month.
  const currentMonth1 = month0 + 1; // 1-12

  let periodYear = year;
  let periodMonth = currentMonth1;

  if (dayOfMonth >= 10) {
    // move to next month
    if (currentMonth1 === 12) {
      periodYear = year + 1;
      periodMonth = 1;
    } else {
      periodMonth = currentMonth1 + 1;
    }
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${periodYear}-${pad(periodMonth)}`;
};

/**
 * Gets the start and end dates for a given month period string (e.g., "2025-11").
 * @param monthPeriod The "YYYY-MM" string.
 * @returns An object with the start and end dates (as ISO strings).
 */
export const getPeriodDates = (monthPeriod: string): { startDate: string; endDate: string } => {
  const [yearStr, monthStr] = monthPeriod.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12

  // Compute previous month and handle year rollover without using Date to avoid timezone issues.
  let startYear = year;
  let startMonth = month - 1; // previous month (1-12)
  if (startMonth === 0) {
    startMonth = 12;
    startYear = year - 1;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const startDate = `${startYear}-${pad(startMonth)}-10`;
  const endDate = `${year}-${pad(month)}-09`;

  return { startDate, endDate };
};
