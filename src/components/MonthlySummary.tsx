import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { fetchEntriesForPeriod } from "../store/milkSlice";
import {
  fetchSettings,
  updateSettings,
  recordPaymentWithLedger,
} from "../store/settingsSlice";
import { getMonthPeriod, getPeriodDates } from "../utils/dateUtils";
import WhatsAppShareButton from "./WhatsAppShareButton";
import UpiPayButton from "./UpiPayButton";
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Grid,
  Chip,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";

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

  // Payment Settlement Dialog State (Khata / Advance calculation)
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [amountPaidInput, setAmountPaidInput] = useState<number | string>(summary.totalAmount);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    setAmountPaidInput(summary.totalAmount);
  }, [summary.totalAmount]);

  const advanceCalculated = useMemo(() => {
    const paid = Number(amountPaidInput) || 0;
    return Number((paid - summary.totalAmount).toFixed(2));
  }, [amountPaidInput, summary.totalAmount]);

  const handleOpenPaymentModal = () => {
    setAmountPaidInput(summary.totalAmount);
    setPayModalOpen(true);
  };

  const handleConfirmPayment = async () => {
    const paidNum = Number(amountPaidInput);
    if (paidNum <= 0) return;

    setRecording(true);
    try {
      await dispatch(
        recordPaymentWithLedger({
          billingPeriod: currentMonthPeriod,
          amountDue: summary.totalAmount,
          amountPaid: paidNum,
          effectiveRate: summary.appliedRate,
          paymentMethod,
          notes: paymentNotes || undefined,
        })
      ).unwrap();
      setPayModalOpen(false);
    } catch (err) {
      console.error("Failed to record payment", err);
    } finally {
      setRecording(false);
    }
  };

  const handleToggleToUnpaid = () => {
    const newPaymentStatus = {
      ...settings.paymentStatus,
      [currentMonthPeriod]: "Unpaid",
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

  const isPaid = summary.paymentStatus === "Paid";

  return (
    <>
      <Card className="rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex justify-between items-center">
            <Typography variant="h6" className="font-bold text-white tracking-wide">
              {displayMonth}
            </Typography>
            <Box className="flex items-center gap-2">
              {settings.advanceBalance && settings.advanceBalance > 0 ? (
                <Chip
                  icon={<AccountBalanceWalletIcon sx={{ color: "white !important" }} />}
                  label={`Advance: ₹${settings.advanceBalance}`}
                  size="small"
                  sx={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white", fontWeight: 600 }}
                />
              ) : null}
              <Chip
                label={isPaid ? "PAID" : "UNPAID"}
                sx={{
                  backgroundColor: isPaid ? "#22c55e" : "#ef4444",
                  color: "white",
                  fontWeight: "bold",
                }}
                size="small"
              />
            </Box>
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

          {/* Action Row: WhatsApp Share, UPI Pay & Payment Status */}
          <Box className="mt-6 flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Box className="flex items-center gap-2">
              {/* WhatsApp Share Button */}
              <WhatsAppShareButton
                monthPeriod={currentMonthPeriod}
                totalQuantity={summary.totalQuantity}
                rate={summary.appliedRate}
                totalAmount={summary.totalAmount}
                paymentStatus={summary.paymentStatus}
                entries={entries}
                vendorPhone={settings.vendorPhone}
                vendorName={settings.vendorName}
              />

              {/* UPI Pay Button (visible when unpaid and vendor UPI configured) */}
              {!isPaid && summary.totalAmount > 0 && settings.vendorUpiId ? (
                <UpiPayButton
                  vendorUpiId={settings.vendorUpiId}
                  vendorName={settings.vendorName}
                  amount={summary.totalAmount}
                  monthPeriod={currentMonthPeriod}
                  onPaidSuccess={handleOpenPaymentModal}
                />
              ) : null}
            </Box>

            {/* Payment Status Toggle */}
            <Box>
              {isPaid ? (
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={handleToggleToUnpaid}
                  className="rounded-lg px-4 py-1.5 normal-case font-semibold border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400"
                >
                  Mark as Unpaid
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleOpenPaymentModal}
                  startIcon={<CheckCircleIcon />}
                  className="rounded-lg px-6 py-2 normal-case font-bold bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-200 dark:shadow-none"
                >
                  Mark as Paid
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Payment Settlement & Khata Ledger Modal */}
      <Dialog open={payModalOpen} onClose={() => setPayModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle className="font-bold flex items-center gap-2">
          <CheckCircleIcon color="success" /> Settle Month's Bill
        </DialogTitle>
        <DialogContent dividers>
          <Box className="mb-4 p-3 bg-blue-50 dark:bg-slate-800 rounded-xl flex justify-between items-center">
            <Typography variant="body2" color="textSecondary">
              Bill Due Amount:
            </Typography>
            <Typography variant="h6" className="font-bold text-blue-600 dark:text-blue-400">
              ₹{summary.totalAmount.toLocaleString()}
            </Typography>
          </Box>

          <TextField
            label="Amount Paid (₹)"
            type="number"
            value={amountPaidInput}
            onChange={(e) => setAmountPaidInput(e.target.value)}
            fullWidth
            size="small"
            className="mb-4"
          />

          {advanceCalculated > 0 ? (
            <Alert severity="info" className="mb-4">
              Advance of <strong>₹{advanceCalculated}</strong> will be credited to your ledger (Khata) balance!
            </Alert>
          ) : advanceCalculated < 0 ? (
            <Alert severity="warning" className="mb-4">
              Underpayment of <strong>₹{Math.abs(advanceCalculated)}</strong> will remain recorded in ledger.
            </Alert>
          ) : null}

          <TextField
            select
            label="Payment Mode"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            fullWidth
            size="small"
            className="mb-4"
          >
            <MenuItem value="UPI">UPI (GPay / PhonePe / Paytm)</MenuItem>
            <MenuItem value="Cash">Cash</MenuItem>
            <MenuItem value="Bank Transfer">Bank Transfer (NEFT/IMPS)</MenuItem>
          </TextField>

          <TextField
            label="Notes (optional)"
            placeholder="e.g. Paid via GPay, ref# 12345"
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            fullWidth
            size="small"
          />
        </DialogContent>
        <DialogActions className="px-6 py-3">
          <Button onClick={() => setPayModalOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirmPayment}
            disabled={recording || Number(amountPaidInput) <= 0}
          >
            {recording ? "Saving..." : "Confirm Payment"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MonthlySummary;
