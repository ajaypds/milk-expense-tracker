import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import type { MilkEntry } from "../types";
import MonthlySummary from "../components/MonthlySummary";
import { getMonthPeriod } from "../utils/dateUtils";
import { fetchDistinctPeriods } from "../store/milkSlice";
import { fetchSettings } from "../store/settingsSlice";
import type { AppDispatch, RootState } from "../store/store";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabase/client";
import { offlineSyncService } from "../services/offlineSyncService";

const BATCH_SIZE = 4; // Number of months to load per batch

const DashboardPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useAuth();
  const { distinctPeriods } = useSelector((s: RootState) => s.milk);
  const { settings } = useSelector((s: RootState) => s.settings);

  const [selectedYear, setSelectedYear] = useState<string>("All");
  const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);
  const [entriesByPeriod, setEntriesByPeriod] = useState<Record<string, MilkEntry[] | null>>({});
  const [isFetchingBatch, setIsFetchingBatch] = useState(false);

  // Sentinel ref for infinite scroll intersection observer
  const observerTarget = useRef<HTMLDivElement | null>(null);

  // Initial fetch of settings and available billing periods
  useEffect(() => {
    dispatch(fetchSettings());
    dispatch(fetchDistinctPeriods());
  }, [dispatch]);

  // Current billing cycle period (e.g. "2026-09")
  const currentPeriod = useMemo(
    () => getMonthPeriod(new Date(), settings.cycleStartDay ?? 10),
    [settings.cycleStartDay]
  );

  // All distinct billing periods sorted newest to oldest
  const allAvailablePeriods = useMemo(() => {
    const set = new Set<string>();
    if (currentPeriod) set.add(currentPeriod);
    (distinctPeriods || []).forEach((p) => {
      if (p) set.add(p);
    });
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [currentPeriod, distinctPeriods]);

  // Available distinct years for the filter dropdown
  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    allAvailablePeriods.forEach((p) => {
      const yr = p.split("-")[0];
      if (yr) yearSet.add(yr);
    });
    return ["All", ...Array.from(yearSet).sort((a, b) => (a < b ? 1 : -1))];
  }, [allAvailablePeriods]);

  // Periods filtered by the selected year
  const filteredPeriods = useMemo(() => {
    if (selectedYear === "All") return allAvailablePeriods;
    return allAvailablePeriods.filter((p) => p.startsWith(selectedYear));
  }, [allAvailablePeriods, selectedYear]);

  // The slice of periods currently visible in the UI
  const visiblePeriods = useMemo(() => {
    return filteredPeriods.slice(0, visibleCount);
  }, [filteredPeriods, visibleCount]);

  const hasMore = visibleCount < filteredPeriods.length;

  // Batch fetch entries for missing visible periods in a single optimized query
  const loadEntriesForBatch = useCallback(
    async (periodsToLoad: string[]) => {
      if (!user || periodsToLoad.length === 0) return;

      // Filter to only those periods not yet loaded or in flight
      const missing = periodsToLoad.filter((p) => entriesByPeriod[p] === undefined);
      if (missing.length === 0) return;

      // Mark missing periods as loading (null)
      setEntriesByPeriod((prev) => {
        const next = { ...prev };
        missing.forEach((p) => {
          next[p] = null;
        });
        return next;
      });

      setIsFetchingBatch(true);

      try {
        // If offline, populate from offline cache
        if (!offlineSyncService.isOnline()) {
          const cached = offlineSyncService.getCachedEntries();
          const grouped: Record<string, MilkEntry[]> = {};
          missing.forEach((p) => {
            grouped[p] = [];
          });

          cached.forEach((entry) => {
            const entryPeriod = getMonthPeriod(new Date(entry.date), settings.cycleStartDay ?? 10);
            if (grouped[entryPeriod]) {
              grouped[entryPeriod].push(entry);
            }
          });

          setEntriesByPeriod((prev) => ({ ...prev, ...grouped }));
          setIsFetchingBatch(false);
          return;
        }

        // Single batch query for all missing periods
        const { data, error } = await supabase
          .from("milk_entries")
          .select("*")
          .eq("user_id", user.id)
          .in("billing_period", missing)
          .order("entry_date", { ascending: true });

        if (error) throw error;

        const grouped: Record<string, MilkEntry[]> = {};
        missing.forEach((p) => {
          grouped[p] = [];
        });

        (data || []).forEach((row) => {
          const bp = row.billing_period;
          if (!grouped[bp]) grouped[bp] = [];
          grouped[bp].push({
            id: row.id,
            date: row.entry_date,
            milkTaken: Boolean(row.milk_taken),
            quantity: Number(row.quantity) || 0,
          });
        });

        setEntriesByPeriod((prev) => ({ ...prev, ...grouped }));
      } catch (err) {
        console.error("Error batch loading period entries:", err);
        // Fallback: empty array to stop perpetual loading state
        setEntriesByPeriod((prev) => {
          const next = { ...prev };
          missing.forEach((p) => {
            if (next[p] === null) next[p] = [];
          });
          return next;
        });
      } finally {
        setIsFetchingBatch(false);
      }
    },
    [user, entriesByPeriod, settings.cycleStartDay]
  );

  // Trigger loading when visiblePeriods change
  useEffect(() => {
    loadEntriesForBatch(visiblePeriods);
  }, [visiblePeriods, loadEntriesForBatch]);

  // Reset pagination when year filter changes
  const handleYearChange = (yr: string) => {
    setSelectedYear(yr);
    setVisibleCount(BATCH_SIZE);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredPeriods.length));
  };

  // Intersection Observer for auto infinite scrolling
  useEffect(() => {
    const currentTarget = observerTarget.current;
    if (!currentTarget || !hasMore || isFetchingBatch) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(currentTarget);
    return () => {
      observer.unobserve(currentTarget);
    };
  }, [hasMore, isFetchingBatch, filteredPeriods.length]);

  return (
    <Container maxWidth="lg" className="py-6">
      {/* Header & Filter Controls */}
      <Box className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <Typography variant="h4" component="h1" className="font-bold flex items-center gap-2">
            <CalendarMonthIcon color="primary" fontSize="large" />
            Monthly Dashboard
          </Typography>
          <Typography variant="body2" color="textSecondary" className="mt-1">
            Complete historical record of all current and previous billing periods with lazy loading.
          </Typography>
        </div>

        <Box className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <Chip
            label={`Showing ${visiblePeriods.length} of ${filteredPeriods.length} months`}
            size="small"
            variant="outlined"
            color="primary"
          />

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="dashboard-year-filter">Filter Year</InputLabel>
            <Select
              labelId="dashboard-year-filter"
              value={selectedYear}
              label="Filter Year"
              onChange={(e) => handleYearChange(e.target.value)}
            >
              {availableYears.map((yr) => (
                <MenuItem key={yr} value={yr}>
                  {yr === "All" ? "All Years" : yr}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Grid of Monthly Cards */}
      {filteredPeriods.length === 0 ? (
        <Paper className="p-8 text-center rounded-2xl" elevation={1}>
          <Typography variant="body1" color="textSecondary">
            No billing periods found for the selected filter.
          </Typography>
        </Paper>
      ) : (
        <Box className="grid grid-cols-1 gap-4">
          {visiblePeriods.map((p) => {
            const entries = entriesByPeriod[p];
            const isLoading = entries === undefined || entries === null;
            return (
              <MonthlySummary
                key={p}
                monthPeriod={p}
                entries={entries ?? undefined}
                loading={isLoading}
              />
            );
          })}
        </Box>
      )}

      {/* Infinite Scroll Sentinel & Load More Controls */}
      <div ref={observerTarget} className="w-full py-4 flex flex-col items-center justify-center">
        {hasMore && (
          <Box className="flex flex-col items-center gap-2 mt-4">
            {isFetchingBatch ? (
              <CircularProgress size={28} />
            ) : (
              <Button
                variant="outlined"
                size="medium"
                startIcon={<ExpandMoreIcon />}
                onClick={handleLoadMore}
                sx={{ textTransform: "none", fontWeight: 600, borderRadius: "12px", px: 4 }}
              >
                Load More Months ({filteredPeriods.length - visibleCount} remaining)
              </Button>
            )}
          </Box>
        )}

        {!hasMore && filteredPeriods.length > 0 && (
          <Box className="flex items-center gap-1.5 text-gray-400 mt-6 select-none">
            <CheckCircleOutlineIcon fontSize="small" />
            <Typography variant="caption" className="font-medium">
              All {filteredPeriods.length} billing periods loaded
            </Typography>
          </Box>
        )}
      </div>
    </Container>
  );
};

export default DashboardPage;
