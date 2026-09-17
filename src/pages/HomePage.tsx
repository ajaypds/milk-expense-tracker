import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Container,
  Paper,
  Typography,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
} from "@mui/material";
import ViewListIcon from "@mui/icons-material/ViewList";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CloudOffIcon from "@mui/icons-material/CloudOff";

import DailyEntryForm from "../components/DailyEntryForm";
import DailyEntriesTable from "../components/DailyEntriesTable";
import DailyCalendarView from "../components/DailyCalendarView";

import type { MilkEntry } from "../types";
import {
  fetchEntriesForPeriod,
  fetchAllEntries,
  fetchDistinctPeriods,
  syncPendingEntries,
} from "../store/milkSlice";
import { getMonthPeriod } from "../utils/dateUtils";
import type { AppDispatch, RootState } from "../store/store";
import { offlineSyncService } from "../services/offlineSyncService";

const HomePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [editingEntry, setEditingEntry] = useState<MilkEntry | null>(null);

  const currentBillingPeriod = useMemo(() => getMonthPeriod(new Date()), []);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentBillingPeriod);

  const entries = useSelector((state: RootState) => state.milk.entries);
  const distinctPeriods = useSelector((state: RootState) => state.milk.distinctPeriods);
  const milkRate = useSelector((state: RootState) => state.settings.settings.milkRate);

  const [viewMode, setViewMode] = useState<"table" | "calendar">(() => {
    try {
      return (
        (localStorage.getItem("milk_tracker_view_mode") as "table" | "calendar") ||
        "table"
      );
    } catch {
      return "table";
    }
  });

  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);

  const periods = useMemo(() => {
    const list = distinctPeriods && distinctPeriods.length > 0 ? [...distinctPeriods] : [];
    if (!list.includes(currentBillingPeriod)) {
      list.unshift(currentBillingPeriod);
    }
    return list;
  }, [distinctPeriods, currentBillingPeriod]);

  // Sync offline entries & check queue on mount and when connection comes online
  useEffect(() => {
    dispatch(fetchDistinctPeriods());

    const checkPending = () => {
      const q = offlineSyncService.getPendingQueue();
      setPendingOfflineCount(q.length);
    };
    checkPending();

    const handleOnline = async () => {
      await dispatch(syncPendingEntries());
      checkPending();
      dispatch(fetchEntriesForPeriod(selectedPeriod));
    };

    window.addEventListener("online", handleOnline);
    if (offlineSyncService.isOnline()) {
      handleOnline();
    }

    return () => window.removeEventListener("online", handleOnline);
  }, [dispatch, selectedPeriod]);

  const handleViewModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: "table" | "calendar" | null
  ) => {
    if (newMode !== null) {
      setViewMode(newMode);
      try {
        localStorage.setItem("milk_tracker_view_mode", newMode);
      } catch (e) {
        console.warn("Could not save view mode to localStorage", e);
      }
    }
  };

  const totalQuantity = entries.reduce(
    (sum, entry) => sum + (entry.milkTaken ? entry.quantity : 0),
    0
  );
  const totalAmount = totalQuantity * milkRate;

  return (
    <Container className="pt-4 pb-12">
      <DailyEntryForm
        initialEntry={editingEntry}
        onSave={async (entry) => {
          setEditingEntry(null);
          // Refresh all entries so the billing period dropdown updates with any new period
          await dispatch(fetchAllEntries());
          try {
            const period = getMonthPeriod(new Date(entry.date));
            await dispatch(fetchEntriesForPeriod(period));
          } catch {
            // ignore
          }
        }}
      />

      <Box className="mt-4">
        <Paper
          className="px-4 py-2.5 mb-4 flex justify-between items-center bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700"
          elevation={1}
        >
          <Typography
            variant="subtitle2"
            className="font-semibold text-gray-600 dark:text-gray-300"
          >
            Current Period Total
          </Typography>
          <div className="flex items-center gap-4">
            <Typography variant="body1" className="font-bold" color="primary">
              {totalQuantity.toFixed(1)} L
            </Typography>
            <Typography variant="body1" className="font-bold" color="primary">
              ₹{totalAmount.toLocaleString()}
            </Typography>
          </div>
        </Paper>
      </Box>

      {/* View Switcher Ribbon */}
      <Box className="flex justify-between items-center my-4">
        <Box className="flex items-center gap-2">
          {pendingOfflineCount > 0 && (
            <Chip
              size="small"
              color="warning"
              icon={<CloudOffIcon fontSize="small" />}
              label={`${pendingOfflineCount} offline pending sync`}
            />
          )}
        </Box>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          size="small"
          aria-label="view mode"
        >
          <ToggleButton value="table" aria-label="table view">
            <ViewListIcon fontSize="small" className="mr-1" />
            Table
          </ToggleButton>
          <ToggleButton value="calendar" aria-label="calendar view">
            <CalendarMonthIcon fontSize="small" className="mr-1" />
            Calendar
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {viewMode === "table" ? (
        <DailyEntriesTable
          selectedPeriod={selectedPeriod}
          onPeriodChange={(p) => setSelectedPeriod(p)}
          onEdit={(entry) => setEditingEntry(entry)}
        />
      ) : (
        <DailyCalendarView
          selectedPeriod={selectedPeriod}
          onPeriodChange={(p) => setSelectedPeriod(p)}
          periods={periods}
          onSelectDate={(entry) => setEditingEntry(entry)}
        />
      )}
    </Container>
  );
};

export default HomePage;
