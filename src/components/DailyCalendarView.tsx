import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import type { MilkEntry } from "../types";
import {
  Box,
  Typography,
  Paper,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import LockIcon from "@mui/icons-material/Lock";
import dayjs from "dayjs";
import { getPeriodDates } from "../utils/dateUtils";

interface Props {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  periods: string[];
  onSelectDate: (entry: MilkEntry) => void;
}

const DailyCalendarView: React.FC<Props> = ({
  selectedPeriod,
  onPeriodChange,
  periods,
  onSelectDate,
}) => {
  const { entries } = useSelector((state: RootState) => state.milk);
  const { settings } = useSelector((state: RootState) => state.settings);
  const paymentStatus = settings.paymentStatus[selectedPeriod] || "Unpaid";
  const isPeriodPaid = paymentStatus === "Paid";

  // Compute all dates within this cycle
  const cycleDates = useMemo(() => {
    const { startDate, endDate } = getPeriodDates(
      selectedPeriod,
      settings.cycleStartDay ?? 10
    );

    const result: string[] = [];
    let curr = dayjs(startDate);
    const end = dayjs(endDate);

    while (curr.isBefore(end) || curr.isSame(end, "day")) {
      result.push(curr.format("YYYY-MM-DD"));
      curr = curr.add(1, "day");
    }
    return result;
  }, [selectedPeriod, settings.cycleStartDay]);

  // Map entries by date for instant O(1) lookup
  const entryMap = useMemo(() => {
    const map = new Map<string, MilkEntry>();
    entries.forEach((e) => {
      map.set(e.date, e);
    });
    return map;
  }, [entries]);

  const todayStr = dayjs().format("YYYY-MM-DD");

  // Summary statistics for this cycle
  const stats = useMemo(() => {
    let deliveredDays = 0;
    let deliveredLiters = 0;
    let skippedDays = 0;
    let unloggedPastDays = 0;

    cycleDates.forEach((d) => {
      const entry = entryMap.get(d);
      if (entry) {
        if (entry.milkTaken && entry.quantity > 0) {
          deliveredDays++;
          deliveredLiters += entry.quantity;
        } else {
          skippedDays++;
        }
      } else if (dayjs(d).isBefore(dayjs(), "day") || d === todayStr) {
        unloggedPastDays++;
      }
    });

    return { deliveredDays, deliveredLiters, skippedDays, unloggedPastDays };
  }, [cycleDates, entryMap, todayStr]);

  return (
    <Box className="w-full">
      {/* Calendar Header Controls & Filters */}
      <Box className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <Box className="flex items-center gap-3">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="calendar-period-label">Billing Cycle</InputLabel>
            <Select
              labelId="calendar-period-label"
              id="calendar-period"
              value={selectedPeriod}
              label="Billing Cycle"
              onChange={(e) => onPeriodChange(String(e.target.value))}
            >
              {periods.map((p) => (
                <MenuItem key={p} value={p}>
                  {dayjs(`${p}-01`).format("MMMM YYYY")} ({p})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {isPeriodPaid && (
            <Chip
              icon={<LockIcon fontSize="small" />}
              label="Cycle Paid"
              color="success"
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {/* Mini KPI Ribbon */}
        <Box className="flex flex-wrap items-center gap-2">
          <Chip
            size="small"
            color="success"
            variant="filled"
            icon={<CheckCircleIcon />}
            label={`${stats.deliveredDays} Delivered (${stats.deliveredLiters.toFixed(1)} L)`}
            sx={{ fontWeight: 600 }}
          />
          <Chip
            size="small"
            color="error"
            variant="outlined"
            icon={<CancelIcon />}
            label={`${stats.skippedDays} Skipped`}
          />
          {stats.unloggedPastDays > 0 && (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              icon={<HelpOutlineIcon />}
              label={`${stats.unloggedPastDays} Pending`}
            />
          )}
        </Box>
      </Box>

      {/* Responsive Calendar Grid */}
      <Box className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {cycleDates.map((dateStr) => {
          const entry = entryMap.get(dateStr);
          const isToday = dateStr === todayStr;
          const isPast = dayjs(dateStr).isBefore(dayjs(), "day");
          const dayNumber = dayjs(dateStr).format("DD");
          const dayName = dayjs(dateStr).format("ddd");
          const monthName = dayjs(dateStr).format("MMM");

          const isDelivered = entry && entry.milkTaken && entry.quantity > 0;
          const isSkipped = entry && (!entry.milkTaken || entry.quantity === 0);
          const isUnlogged = !entry;

          return (
            <Tooltip
              key={dateStr}
              title={
                isPeriodPaid
                  ? `Cycle is paid (${dateStr})`
                  : isDelivered
                  ? `Delivered: ${entry?.quantity} L on ${dateStr}. Click to edit.`
                  : isSkipped
                  ? `Skipped on ${dateStr}. Click to edit.`
                  : `Not logged yet. Click to log milk for ${dateStr}.`
              }
              arrow
            >
              <Paper
                elevation={isToday ? 3 : 1}
                onClick={() => {
                  if (!isPeriodPaid) {
                    onSelectDate(
                      entry || {
                        date: dateStr,
                        milkTaken: true,
                        quantity: 1,
                      }
                    );
                  }
                }}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                  isToday
                    ? "border-blue-500 ring-2 ring-blue-400/40 dark:ring-blue-500/40"
                    : "border-slate-200 dark:border-slate-700/80 hover:border-blue-400"
                } ${
                  isDelivered
                    ? "bg-emerald-50/70 dark:bg-emerald-950/30"
                    : isSkipped
                    ? "bg-rose-50/70 dark:bg-rose-950/30"
                    : isPast
                    ? "bg-slate-50 dark:bg-slate-800/40 border-dashed"
                    : "bg-white dark:bg-slate-800"
                }`}
                sx={{ minHeight: 88 }}
              >
                {/* Day Header */}
                <Box className="flex justify-between items-center mb-1.5">
                  <Box className="flex items-baseline gap-1">
                    <Typography
                      variant="body2"
                      className={`font-bold ${
                        isToday
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {dayNumber}
                    </Typography>
                    <Typography
                      variant="caption"
                      className="text-slate-500 dark:text-slate-400 text-xs"
                    >
                      {monthName}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    className={`text-[11px] font-medium ${
                      dayName === "Sun"
                        ? "text-rose-500 dark:text-rose-400"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {dayName}
                  </Typography>
                </Box>

                {/* Status Indicator */}
                <Box className="flex justify-center my-auto">
                  {isDelivered && (
                    <Box className="w-full py-0.5 px-1.5 rounded-md bg-emerald-100/90 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-center font-bold text-xs flex items-center justify-center gap-1">
                      <span>🥛</span>
                      <span>{entry.quantity} L</span>
                    </Box>
                  )}

                  {isSkipped && (
                    <Box className="w-full py-0.5 px-1.5 rounded-md bg-rose-100/90 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 text-center font-semibold text-xs flex items-center justify-center gap-1">
                      <span>🚫</span>
                      <span>Skipped</span>
                    </Box>
                  )}

                  {isUnlogged && (
                    <Typography
                      variant="caption"
                      className={`text-center font-medium ${
                        isPast
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {isPast ? "⏳ Log" : "--"}
                    </Typography>
                  )}
                </Box>

                {/* Today Pill */}
                {isToday && (
                  <Box className="mt-1 text-center">
                    <Typography
                      variant="caption"
                      className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400"
                    >
                      Today
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
};

export default DailyCalendarView;
