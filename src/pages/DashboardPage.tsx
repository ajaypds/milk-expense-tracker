import React, { useEffect, useState } from "react";
import { Container, Paper, Typography, Box } from "@mui/material";
import type { MilkEntry } from "../types";
import MonthlySummary from "../components/MonthlySummary";
import { getMonthPeriod } from "../utils/dateUtils";
import {
  fetchEntriesForPeriod,
  fetchDistinctPeriods,
} from "../store/milkSlice";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";

// Helper to compute previous YYYY-MM
const prevPeriod = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  let year = y;
  let month = m - 1;
  if (month === 0) {
    month = 12;
    year = y - 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
};

const DashboardPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [entriesByPeriod, setEntriesByPeriod] = useState<
    Record<string, MilkEntry[] | null>
  >({});
  const { distinctPeriods } = useSelector((s: RootState) => s.milk);
  useEffect(() => {
    // ensure we have the list of distinct periods
    dispatch(fetchDistinctPeriods());
  }, [dispatch]);

  useEffect(() => {
    const loadForPeriods = async (periods: string[]) => {
      // mark missing periods as loading (null)
      setEntriesByPeriod((s) => {
        const copy = { ...s };
        periods.forEach((p) => {
          if (!(p in copy)) copy[p] = null;
        });
        return copy;
      });

      // fetch entries for each period if not already loaded
      for (const p of periods) {
        const existing = entriesByPeriod[p];
        if (existing !== undefined && existing !== null) continue;
        try {
          const res = await dispatch(fetchEntriesForPeriod(p));
          const payload =
            (res as unknown as { payload?: MilkEntry[] }).payload ?? [];
          setEntriesByPeriod((s) => ({ ...s, [p]: payload }));
        } catch (err) {
          console.error("Failed to fetch entries for", p, err);
          setEntriesByPeriod((s) => ({ ...s, [p]: [] }));
        }
      }
    };

    const current = getMonthPeriod(new Date());
    const previous = prevPeriod(current);

    const periods =
      distinctPeriods && distinctPeriods.length
        ? distinctPeriods
        : [current, previous];

    loadForPeriods(periods);
    // we intentionally omit entriesByPeriod from deps to avoid re-running on each per-period set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distinctPeriods, dispatch]);

  return (
    <Container maxWidth="lg" className="py-6">
      <Typography variant="h4" component="h1" className="font-bold mb-6">
        {/* Monthly Dashboard */}
      </Typography>
      <Box className="grid grid-cols-1 gap-3">
        {(() => {
          const current = getMonthPeriod(new Date());
          const previous = prevPeriod(current);
          const periods = [current, previous];

          return periods.map((p) => {
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
          });
        })()}
      </Box>
    </Container>
  );
};

export default DashboardPage;
