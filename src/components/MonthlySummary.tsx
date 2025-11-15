import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { fetchEntriesForPeriod } from "../store/milkSlice";
import { fetchSettings, updateSettings } from "../store/settingsSlice";
import { getMonthPeriod } from "../utils/dateUtils";
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

  // Determine the billing period to show: propMonth or current
  const currentMonthPeriod = useMemo(
    () => propMonth ?? getMonthPeriod(new Date()),
    [propMonth]
  );

  // Friendly display for the period (e.g. "November 2025")
  const displayMonth = useMemo(() => {
    try {
      // currentMonthPeriod is in "YYYY-MM" format; construct a date on the 1st
      const d = new Date(`${currentMonthPeriod}-01T00:00:00`);
      return d.toLocaleString(undefined, { month: "long", year: "numeric" });
    } catch {
      return currentMonthPeriod;
    }
  }, [currentMonthPeriod]);

  useEffect(() => {
    // Fetch settings
    dispatch(fetchSettings());

    // Only fetch entries when parent didn't provide them
    if (!propEntries) {
      dispatch(fetchEntriesForPeriod(currentMonthPeriod));
    }
  }, [dispatch, currentMonthPeriod, propEntries]);
  // Read store entries (always call hook) and allow prop to override
  const storeEntries = useSelector((state: RootState) => state.milk.entries);
  const entries: import("../types").MilkEntry[] = propEntries ?? storeEntries;

  // Calculate summary
  const summary = useMemo(() => {
    const totalQuantity = entries.reduce(
      (acc, entry) => acc + (entry.milkTaken ? entry.quantity : 0),
      0
    );
    const totalAmount = totalQuantity * settings.milkRate;
    const paymentStatus =
      settings.paymentStatus[currentMonthPeriod] || "Unpaid";
    return { totalQuantity, totalAmount, paymentStatus };
  }, [entries, settings.milkRate, settings.paymentStatus, currentMonthPeriod]);

  const handleTogglePaymentStatus = () => {
    const newStatus = (summary.paymentStatus === "Paid" ? "Unpaid" : "Paid") as
      | "Paid"
      | "Unpaid";
    const newPaymentStatus = {
      ...settings.paymentStatus,
      [currentMonthPeriod]: newStatus,
    };
    dispatch(updateSettings({ paymentStatus: newPaymentStatus }));
  };

  // If parent gave an explicit loading prop, prefer that; otherwise fallback to store flags
  const isLoading =
    typeof propLoading === "boolean"
      ? propLoading
      : entriesLoading || settingsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" className="font-semibold mb-2">
            <Skeleton width={180} />
          </Typography>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
          <Box className="mt-4 flex items-center justify-between">
            <Skeleton variant="rectangular" width={120} height={36} />
            <Skeleton variant="rectangular" width={140} height={36} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <CardContent>
        <Typography variant="h6" component="h2" className="font-semibold mb-4">
          {displayMonth}
        </Typography>
        {/* <Grid container spacing={2}> */}
        <Grid>
          <Typography>
            <strong>Total Milk:</strong> {summary.totalQuantity.toFixed(2)}{" "}
            Liters
          </Typography>
        </Grid>
        <Grid>
          <Typography>
            <strong>Milk Rate:</strong> ₹{settings.milkRate} / liter
          </Typography>
        </Grid>
        <Grid>
          <Typography variant="h6" component="p" className="font-bold">
            <strong>Total Amount:</strong> ₹{summary.totalAmount.toFixed(2)}
          </Typography>
        </Grid>
        <Grid className="flex items-center justify-between pt-2">
          <Box>
            <Typography component="span" className="mr-2">
              <strong>Status:</strong>
            </Typography>
            <Chip
              label={summary.paymentStatus}
              color={summary.paymentStatus === "Paid" ? "success" : "error"}
              size="small"
            />
          </Box>
          <Button variant="contained" onClick={handleTogglePaymentStatus}>
            Mark as {summary.paymentStatus === "Paid" ? "Unpaid" : "Paid"}
          </Button>
        </Grid>
        {/* </Grid> */}
      </CardContent>
    </>
  );
};

export default MonthlySummary;
