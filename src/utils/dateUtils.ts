/**
 * Calculates the billing period string (e.g., "2025-11") for a given date.
 * By default, the period runs from the 10th of the previous month to the 9th of the current month.
 * If cycleStartDay is 1, the period is the exact calendar month (1st to end of month).
 * 
 * @param date The date for which to determine the billing period.
 * @param cycleStartDay The starting day of the billing cycle (1 to 28, default 10).
 * @returns The billing period as a "YYYY-MM" string.
 */
export const getMonthPeriod = (date: Date, cycleStartDay: number = 10): string => {
  const year = date.getFullYear();
  const month0 = date.getMonth(); // 0-indexed (0 for Jan)
  const dayOfMonth = date.getDate();
  const currentMonth1 = month0 + 1; // 1-12

  const pad = (n: number) => String(n).padStart(2, "0");

  if (cycleStartDay <= 1) {
    return `${year}-${pad(currentMonth1)}`;
  }

  let periodYear = year;
  let periodMonth = currentMonth1;

  if (dayOfMonth >= cycleStartDay) {
    // move to next month
    if (currentMonth1 === 12) {
      periodYear = year + 1;
      periodMonth = 1;
    } else {
      periodMonth = currentMonth1 + 1;
    }
  }

  return `${periodYear}-${pad(periodMonth)}`;
};

/**
 * Gets the start and end dates for a given month period string (e.g., "2025-11").
 * 
 * @param monthPeriod The "YYYY-MM" string.
 * @param cycleStartDay The starting day of the billing cycle (1 to 28, default 10).
 * @returns An object with the start and end dates (as ISO strings "YYYY-MM-DD").
 */
export const getPeriodDates = (
  monthPeriod: string,
  cycleStartDay: number = 10
): { startDate: string; endDate: string } => {
  const [yearStr, monthStr] = monthPeriod.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12
  const pad = (n: number) => String(n).padStart(2, "0");

  if (cycleStartDay <= 1) {
    // 1st to last day of the calendar month
    const lastDay = new Date(year, month, 0).getDate();
    return {
      startDate: `${year}-${pad(month)}-01`,
      endDate: `${year}-${pad(month)}-${pad(lastDay)}`,
    };
  }

  // Compute previous month
  let startYear = year;
  let startMonth = month - 1; // previous month (1-12)
  if (startMonth === 0) {
    startMonth = 12;
    startYear = year - 1;
  }

  const endDay = cycleStartDay - 1;
  const startDate = `${startYear}-${pad(startMonth)}-${pad(cycleStartDay)}`;
  const endDate = `${year}-${pad(month)}-${pad(endDay)}`;

  return { startDate, endDate };
};
