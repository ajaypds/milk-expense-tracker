import React, { useEffect, useState, useMemo } from "react";
import {
  Container,
  Typography,
  Paper,
  Box,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import dayjs from "dayjs";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { fetchSettings } from "../store/settingsSlice";
import WhatsAppShareButton from "../components/WhatsAppShareButton";
import { supabase } from "../supabase/client";
import { useAuth } from "../context/AuthContext";
import { getPeriodDates } from "../utils/dateUtils";
import type { PaidMonthReport, MilkEntry } from "../types";

const ReportsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { settings } = useSelector((state: RootState) => state.settings);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [paidMonths, setPaidMonths] = useState<PaidMonthReport[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("All");

  // State for viewing detailed daily entries of a specific period
  const [detailPeriod, setDetailPeriod] = useState<string | null>(null);
  const [detailEntries, setDetailEntries] = useState<MilkEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchSettings());
    const fetchPaidReports = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("billing_periods")
          .select("*")
          .eq("user_id", user.id)
          .eq("payment_status", "Paid")
          .order("billing_period", { ascending: false });

        if (error) throw error;

        const reports: PaidMonthReport[] = (data || []).map((row) => ({
          id: row.id,
          billingPeriod: row.billing_period,
          paymentStatus: row.payment_status as "Paid",
          totalLiters: Number(row.total_liters) || 0,
          effectiveRate: Number(row.effective_rate) || 55,
          totalAmount: Number(row.total_amount) || 0,
          paidAt: row.paid_at,
          notes: row.notes,
        }));

        setPaidMonths(reports);
      } catch (err) {
        console.error("Error fetching paid month reports:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPaidReports();
  }, [user]);

  // Extract distinct years from billing periods (e.g. "2026-09" -> "2026")
  const availableYears = useMemo(() => {
    const years = new Set(paidMonths.map((p) => p.billingPeriod.split("-")[0]));
    return ["All", ...Array.from(years).sort((a, b) => (a < b ? 1 : -1))];
  }, [paidMonths]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    if (selectedYear === "All") return paidMonths;
    return paidMonths.filter((p) => p.billingPeriod.startsWith(selectedYear));
  }, [paidMonths, selectedYear]);

  // Aggregate statistics for the selected filter
  const summaryStats = useMemo(() => {
    const totalAmount = filteredReports.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalLiters = filteredReports.reduce((sum, r) => sum + r.totalLiters, 0);
    const monthsCount = filteredReports.length;
    const avgMonthlyBill = monthsCount > 0 ? Math.round(totalAmount / monthsCount) : 0;
    return { totalAmount, totalLiters, monthsCount, avgMonthlyBill };
  }, [filteredReports]);

  // Open detailed entries modal for a billing period
  const handleViewDetails = async (period: string) => {
    setDetailPeriod(period);
    setDetailLoading(true);
    try {
      if (!user) return;
      const { data, error } = await supabase
        .from("milk_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("billing_period", period)
        .order("entry_date", { ascending: true });

      if (error) throw error;

      setDetailEntries(
        (data || []).map((d) => ({
          id: d.id,
          date: d.entry_date,
          milkTaken: Boolean(d.milk_taken),
          quantity: Number(d.quantity) || 0,
        }))
      );
    } catch (err) {
      console.error("Error loading period entries:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setDetailPeriod(null);
    setDetailEntries([]);
  };

  const activeDetailReport = useMemo(
    () => paidMonths.find((p) => p.billingPeriod === detailPeriod),
    [paidMonths, detailPeriod]
  );

  return (
    <Container maxWidth="lg" className="py-6">
      <Box className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <Typography variant="h4" component="h1" className="font-bold flex items-center gap-2">
            Paid Months Report
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Historical record of all settled milk expenses with frozen rates and verified payments.
          </Typography>
        </div>

        {/* Year Filter */}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="year-filter-label">Filter Year</InputLabel>
          <Select
            labelId="year-filter-label"
            id="yearFilter"
            value={selectedYear}
            label="Filter Year"
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {availableYears.map((yr) => (
              <MenuItem key={yr} value={yr}>
                {yr === "All" ? "All Years" : yr}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* KPI Overview Ribbon */}
      <Grid container spacing={2} className="mb-6">
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper className="p-4 bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700" elevation={1}>
            <Typography variant="caption" className="font-medium text-gray-500 dark:text-gray-400">
              Total Amount Paid
            </Typography>
            <Typography variant="h5" className="font-bold text-blue-600 dark:text-blue-400 mt-1">
              ₹{summaryStats.totalAmount.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper className="p-4 bg-emerald-50 dark:bg-slate-800 border border-emerald-100 dark:border-slate-700" elevation={1}>
            <Typography variant="caption" className="font-medium text-gray-500 dark:text-gray-400">
              Total Liters
            </Typography>
            <Typography variant="h5" className="font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {summaryStats.totalLiters.toFixed(1)} L
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper className="p-4 bg-amber-50 dark:bg-slate-800 border border-amber-100 dark:border-slate-700" elevation={1}>
            <Typography variant="caption" className="font-medium text-gray-500 dark:text-gray-400">
              Average / Month
            </Typography>
            <Typography variant="h5" className="font-bold text-amber-600 dark:text-amber-400 mt-1">
              ₹{summaryStats.avgMonthlyBill.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper className="p-4 bg-purple-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700" elevation={1}>
            <Typography variant="caption" className="font-medium text-gray-500 dark:text-gray-400">
              Settled Months
            </Typography>
            <Typography variant="h5" className="font-bold text-purple-600 dark:text-purple-400 mt-1">
              {summaryStats.monthsCount}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Main Reports Table */}
      {loading ? (
        <Box display="flex" justifyContent="center" className="py-12">
          <CircularProgress />
        </Box>
      ) : filteredReports.length === 0 ? (
        <Paper className="p-8 text-center" elevation={1}>
          <Typography variant="body1" color="textSecondary">
            No paid billing periods found for the selected filter.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={1} className="rounded-xl overflow-hidden">
          <Table>
            <TableHead className="bg-slate-50 dark:bg-slate-800/80">
              <TableRow>
                <TableCell className="font-bold">Billing Cycle</TableCell>
                <TableCell className="font-bold">Date Range</TableCell>
                <TableCell className="font-bold" align="right">Liters Consumed</TableCell>
                <TableCell className="font-bold" align="right">Applied Rate</TableCell>
                <TableCell className="font-bold" align="right">Total Paid</TableCell>
                <TableCell className="font-bold" align="center">Settled On</TableCell>
                <TableCell className="font-bold" align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredReports.map((report) => {
                const dates = getPeriodDates(report.billingPeriod);
                const readablePeriod = dayjs(`${report.billingPeriod}-01`).format("MMMM YYYY");
                const formattedStartDate = dayjs(dates.startDate).format("DD MMM YYYY");
                const formattedEndDate = dayjs(dates.endDate).format("DD MMM YYYY");

                return (
                  <TableRow key={report.id} hover>
                    <TableCell className="font-semibold">
                      <Box className="flex items-center gap-2">
                        <CheckCircleIcon color="success" fontSize="small" />
                        <span>{readablePeriod}</span>
                        <Typography variant="caption" color="textSecondary">
                          ({report.billingPeriod})
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {formattedStartDate} → {formattedEndDate}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" className="font-medium">
                      {report.totalLiters} L
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={`₹${report.effectiveRate}/L`} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right" className="font-bold text-blue-600 dark:text-blue-400">
                      ₹{report.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" color="textSecondary">
                        {report.paidAt ? dayjs(report.paidAt).format("DD/MM/YYYY") : "Settled"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handleViewDetails(report.billingPeriod)}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Details Dialog for a Specific Month */}
      <Dialog
        open={Boolean(detailPeriod)}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle className="flex justify-between items-center">
          <Typography variant="h6" className="font-bold">
            Daily Log Breakdown — {detailPeriod ? dayjs(`${detailPeriod}-01`).format("MMMM YYYY") : ""}
          </Typography>
          <IconButton onClick={handleCloseDetails} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box display="flex" justifyContent="center" className="py-8">
              <CircularProgress />
            </Box>
          ) : detailEntries.length === 0 ? (
            <Typography variant="body2" color="textSecondary" className="py-4 text-center">
              No daily entries found for this cycle.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell className="font-semibold">Date</TableCell>
                    <TableCell className="font-semibold">Status</TableCell>
                    <TableCell className="font-semibold" align="right">Quantity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailEntries.map((entry) => (
                    <TableRow key={entry.id || entry.date}>
                      <TableCell>{dayjs(entry.date).format("DD/MM/YYYY (ddd)")}</TableCell>
                      <TableCell>
                        {entry.milkTaken ? (
                          <Chip label="Delivered" size="small" color="success" variant="outlined" />
                        ) : (
                          <Chip label="Skipped" size="small" color="default" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell align="right" className="font-bold">
                        {entry.milkTaken ? `${entry.quantity} L` : "0 L"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions className="px-6 py-3 flex justify-between">
          {detailPeriod && activeDetailReport ? (
            <WhatsAppShareButton
              monthPeriod={detailPeriod}
              totalQuantity={activeDetailReport.totalLiters}
              rate={activeDetailReport.effectiveRate}
              totalAmount={activeDetailReport.totalAmount}
              paymentStatus="Paid"
              entries={detailEntries}
              vendorPhone={settings.vendorPhone}
              vendorName={settings.vendorName}
            />
          ) : (
            <Box />
          )}
          <Button onClick={handleCloseDetails} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ReportsPage;
