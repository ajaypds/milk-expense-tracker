import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../store/store";
import type { MilkEntry } from "../types";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  Box,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";
import {
  fetchEntriesForPeriod,
  fetchEntriesPage,
  clearEntries,
  fetchDistinctPeriods,
} from "../store/milkSlice";
import { getMonthPeriod } from "../utils/dateUtils";
import type { AppDispatch } from "../store/store";
import { fetchSettings } from "../store/settingsSlice";

interface Props {
  onEdit?: (entry: MilkEntry) => void;
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
}

const DailyEntriesTable: React.FC<Props> = ({
  onEdit,
  selectedPeriod: propPeriod,
  onPeriodChange,
}) => {
  const { entries, loading, distinctPeriods } = useSelector(
    (state: RootState) => state.milk
  );
  const paymentStatus = useSelector(
    (state: RootState) => state.settings.settings.paymentStatus
  );
  const dispatch = useDispatch<AppDispatch>();

  // Debugging: expose whether entries in Redux are more than 5
  const [showRaw, setShowRaw] = useState(false);
  // default to current billing period so the page initially shows the current cycle
  const initialPeriod = getMonthPeriod(new Date());
  const [internalPeriod, setInternalPeriod] = useState<string>(initialPeriod);
  const periodFilter = propPeriod !== undefined ? propPeriod : internalPeriod;
  const setPeriodFilter = (p: string) => {
    if (onPeriodChange) onPeriodChange(p);
    else setInternalPeriod(p);
  };
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  type FetchPagePayload = { entries: MilkEntry[]; last: string | null };

  // use server-provided distinct periods if available; otherwise fall back to deriving from loaded entries
  const periods = React.useMemo(() => {
    if (distinctPeriods && distinctPeriods.length) return distinctPeriods;
    const s = new Set(entries.map((e) => dayjs(e.date).format("YYYY-MM")));
    return Array.from(s).sort((a, b) => (a < b ? 1 : -1));
  }, [entries, distinctPeriods]);

  useEffect(() => {
    // fetch distinct periods for the dropdown
    dispatch(fetchDistinctPeriods());
    dispatch(fetchSettings());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ensure the current billing cycle is selectable even if there are no entries for it yet
  const currentBillingPeriod = React.useMemo(
    () => getMonthPeriod(new Date()),
    []
  );

  useEffect(() => {
    // Log entries for debug - helps check whether the data contains more than 5 rows
    console.log(
      "DailyEntriesTable - entries count:",
      entries.length,
      entries.map((e) => e.id || e.date)
    );
  }, [entries]);

  useEffect(() => {
    console.log("Payment status:", paymentStatus);
  }, [paymentStatus]);

  // When user changes periodFilter, dispatch server-side fetch
  useEffect(() => {
    const run = async () => {
      // clear currently loaded entries
      dispatch(clearEntries());
      setLastDate(null);
      setHasMore(true);

      // console.log("Fetching entries for period filter:", periodFilter);

      if (periodFilter === "All") {
        const res = await dispatch(fetchEntriesPage({ pageSize: 20 }));
        const result = res as { payload?: FetchPagePayload };
        if (result.payload) {
          setLastDate(result.payload.last);
          setHasMore((result.payload.entries?.length ?? 0) >= 20);
        }
      } else {
        await dispatch(fetchEntriesForPeriod(periodFilter));
        setHasMore(false);
      }
    };

    run();
    // we intentionally want to run this when periodFilter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFilter]);

  const filtered = React.useMemo(() => {
    if (periodFilter === "All") return entries;
    // Use billing-period logic (10th -> 9th) to determine which period an entry belongs to
    return entries.filter((e) => {
      try {
        const d = new Date(e.date);
        return getMonthPeriod(d) === periodFilter;
      } catch {
        // fallback to calendar-month comparison if parsing fails
        return dayjs(e.date).format("YYYY-MM") === periodFilter;
      }
    });
  }, [entries, periodFilter]);

  const sorted = React.useMemo(
    () => [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [filtered]
  );

  return (
    <>
      <Typography variant="h6" className="mb-4 font-semibold">
        Entries
      </Typography>
      <Box className="mb-3 landscape:flex items-center justify-between gap-3">
        <Box className="flex items-center gap-4">
          <Typography variant="body2" color="textSecondary">
            Showing {sorted.length} entries
          </Typography>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="period-filter-label">Billing period</InputLabel>
            <Select
              labelId="period-filter-label"
              id="period-filter"
              value={periodFilter}
              label="Billing period"
              onChange={(e) => setPeriodFilter(String(e.target.value))}
            >
              {/* <MenuItem value="All">All</MenuItem> */}
              {/* No far-future automatic period is shown to avoid suggesting incomplete future cycles */}
              {currentBillingPeriod &&
                !periods.includes(currentBillingPeriod) && (
                  <MenuItem
                    key={currentBillingPeriod}
                    value={currentBillingPeriod}
                  >
                    {dayjs(`${currentBillingPeriod}-01`).format("MMMM YYYY")} (
                    {currentBillingPeriod})
                  </MenuItem>
                )}
              {periods.map((p) => (
                <MenuItem key={p} value={p}>
                  {dayjs(`${p}-01`).format("MMMM YYYY")} ({p})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Button size="small" onClick={() => setShowRaw((s) => !s)}>
          {showRaw ? "Hide raw" : "Show raw"}
        </Button>
      </Box>
      {loading ? (
        <Box display="flex" justifyContent="center" className="py-8">
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ maxHeight: 420 }}
          >
            <Table aria-label="daily entries table" size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell align="center">Taken</TableCell>
                  <TableCell align="center">Quantity (L)</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" className="py-8">
                      No entries found for selected period.
                    </TableCell>
                  </TableRow>
                )}
                {sorted.map((entry) => (
                  <TableRow key={entry.id || entry.date} hover>
                    <TableCell component="th" scope="row">
                      {dayjs(entry.date).format("DD-MM-YYYY")}
                    </TableCell>
                    <TableCell align="center">
                      {entry.milkTaken ? (
                        <CheckIcon color="success" />
                      ) : (
                        <CloseIcon color="error" />
                      )}
                    </TableCell>
                    <TableCell align="center">{entry.quantity}</TableCell>
                    <TableCell align="center">
                      {paymentStatus[periodFilter] === "Paid" ? (
                        ""
                      ) : (
                        <IconButton
                          size="small"
                          onClick={() => onEdit && onEdit(entry)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {/* Pagination: load more when in 'All' mode and there are more pages */}
          {periodFilter === "All" && hasMore && (
            <Box className="mt-3 text-center">
              <Button
                variant="outlined"
                size="small"
                onClick={async () => {
                  if (!lastDate) return;
                  const res = await dispatch(
                    fetchEntriesPage({ pageSize: 20, startAfter: lastDate })
                  );
                  const result = res as { payload?: FetchPagePayload };
                  if (result.payload) {
                    setLastDate(result.payload.last);
                    setHasMore((result.payload.entries?.length ?? 0) >= 20);
                  }
                }}
              >
                Load more
              </Button>
            </Box>
          )}
          {showRaw && (
            <Box
              component="pre"
              className="mt-3 p-3 bg-gray-100 rounded text-sm overflow-auto"
              sx={{ maxHeight: 240 }}
            >
              {JSON.stringify(entries, null, 2)}
            </Box>
          )}
        </>
      )}
    </>
  );
};

export default DailyEntriesTable;
