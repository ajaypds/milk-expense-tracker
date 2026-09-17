import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { fetchEntriesForPeriod } from "../store/milkSlice";
import { fetchSettings, updateSettings } from "../store/settingsSlice";
import { getMonthPeriod, getPeriodDates } from "../utils/dateUtils";
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Grid,
  Chip,
  Skeleton,
} from "@mui/material";

interface Props {
  monthPeriod?: string;
  entries?: import("../types").MilkEntry[];
  loading?: boolean;
}

const MonthlySummary: React.FC<Props> = ({
  monthPeriod: propMonth,
  entries: propEntries,
  loading: propLoading,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading: entriesLoading } = useSelector(
    (state: RootState) => state.milk
  );
  const { settings, loading: settingsLoading } = useSelector(
    (state: RootState) => state.settings
  );

  const currentMonthPeriod = useMemo(
    () => propMonth ?? getMonthPeriod(new Date()),
    [propMonth]
  );

  const displayMonth = useMemo(() => {
    try {
      const d = new Date(`${currentMonthPeriod}-01T00:00:00`);
      return d.toLocaleString(undefined, { month: "long", year: "numeric" });
    } catch {
      return currentMonthPeriod;
    }
  }, [currentMonthPeriod]);

  useEffect(() => {
    dispatch(fetchSettings());
    if (!propEntries) {
      dispatch(fetchEntriesForPeriod(currentMonthPeriod));
    }
  }, [dispatch, currentMonthPeriod, propEntries]);

  const storeEntries = useSelector((state: RootState) => state.milk.entries);
  const entries: import("../types").MilkEntry[] = propEntries ?? storeEntries;

  const appliedRate = useMemo(() => {
    if (!settings.rateHistory || settings.rateHistory.length === 0) {
      return settings.milkRate || 55;
    }
    const dates = getPeriodDates(currentMonthPeriod, settings.cycleStartDay ?? 10);
    const match = settings.rateHistory.find((r) => r.effective_from <= dates.endDate);
    return match ? match.rate : settings.milkRate || 55;
  }, [settings.rateHistory, settings.milkRate, settings.cycleStartDay, currentMonthPeriod]);

  const summary = useMemo(() => {
    const totalQuantity = entries.reduce(
      (acc, entry) => acc + (entry.milkTaken ? entry.quantity : 0),
      0
    );
    const totalAmount = totalQuantity * appliedRate;
    const paymentStatus = (settings.paymentStatus[currentMonthPeriod] || "Unpaid") as "Paid" | "Unpaid";
    return { totalQuantity, totalAmount, paymentStatus, appliedRate };
  }, [entries, appliedRate, settings.paymentStatus, currentMonthPeriod]);

  const handleTogglePaymentStatus = () => {
    const newStatus = summary.paymentStatus === "Paid" ? "Unpaid" : "Paid";
    const newPaymentStatus = {
      ...settings.paymentStatus,
      [currentMonthPeriod]: newStatus,
    } as Record<string, "Paid" | "Unpaid">;
    dispatch(updateSettings({ paymentStatus: newPaymentStatus }));
  };

  const isLoading =
    typeof propLoading === "boolean"
      ? propLoading
      : entriesLoading || settingsLoading;

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <CardContent className="p-6">
          <Skeleton width={180} height={32} className="mb-6 rounded-lg" />
          <Grid container spacing={3}>
            {[1, 2, 3].map((i) => (
              <Grid size={{ xs: 12, sm: 4 }} key={i}>
                <Skeleton variant="rectangular" height={100} className="rounded-xl" />
              </Grid>
            ))}
          </Grid>
          <Box className="mt-6 flex justify-end">
            <Skeleton variant="rectangular" width={140} height={40} className="rounded-lg" />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <div className="flex justify-between items-center">
          <Typography variant="h6" className="font-bold text-white tracking-wide">
            {displayMonth}
          </Typography>
          <Chip
            label={summary.paymentStatus.toUpperCase()}
            sx={{
              backgroundColor: summary.paymentStatus === "Paid" ? "#22c55e" : "#ef4444", // green-500 : red-500
              color: "white",
              fontWeight: "bold",
            }}
            size="small"
          />
        </div>
      </div>

      <CardContent className="p-6">
        <Grid container spacing={3}>
          {/* Total Quantity Card */}
          <Grid size={{ xs: 6, md: 4 }}>
            <div className="bg-blue-50 dark:bg-slate-800 p-4 rounded-xl h-full border border-blue-100 dark:border-slate-700">
              <Typography variant="caption" className="text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block mb-1">
                Total Milk
              </Typography>
              <Typography variant="h4" className="text-blue-600 dark:text-blue-400 font-bold">
                {summary.totalQuantity} <span className="text-lg text-gray-400">L</span>
              </Typography>
            </div>
          </Grid>

          {/* Rate Card */}
          <Grid size={{ xs: 6, md: 4 }}>
            <div className="bg-purple-50 dark:bg-slate-800 p-4 rounded-xl h-full border border-purple-100 dark:border-slate-700">
              <Typography variant="caption" className="text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block mb-1">
                Applied Rate
              </Typography>
              <Typography variant="h4" className="text-purple-600 dark:text-purple-400 font-bold">
                ₹{summary.appliedRate} <span className="text-lg text-gray-400">/L</span>
              </Typography>
            </div>
          </Grid>

          {/* Total Amount Card */}
          <Grid size={{ xs: 12, md: 4 }}>
            <div className="bg-emerald-50 dark:bg-slate-800 p-4 rounded-xl h-full border border-emerald-100 dark:border-slate-700 flex flex-col justify-center">
              <Typography variant="caption" className="text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block mb-1">
                Amount Due
              </Typography>
              <Typography variant="h3" className="text-emerald-600 dark:text-emerald-400 font-bold">
                ₹{summary.totalAmount.toFixed(0)}
              </Typography>
            </div>
          </Grid>
        </Grid>

        <Box className="mt-6 flex justify-end">
          <Button
            variant={summary.paymentStatus === "Paid" ? "outlined" : "contained"}
            color={summary.paymentStatus === "Paid" ? "inherit" : "primary"}
            onClick={handleTogglePaymentStatus}
            className={`rounded-lg px-6 py-2 normal-case font-bold ${
              summary.paymentStatus === "Paid" 
                ? "border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-200 dark:shadow-none"
            }`}
          >
            {summary.paymentStatus === "Paid" ? "Mark as Unpaid" : "Mark as Paid"}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MonthlySummary;
