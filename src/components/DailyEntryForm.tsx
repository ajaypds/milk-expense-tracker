import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { upsertMilkEntry } from "../store/milkSlice";
import { supabase } from "../supabase/client";
import type { MilkEntry } from "../types";
import {
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Button,
  Typography,
  Grid,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/en-gb";
import { getMonthPeriod } from "../utils/dateUtils";
dayjs.locale("en-gb");

interface Props {
  initialEntry?: MilkEntry | null;
  onSave?: (entry: MilkEntry) => void;
}

const DailyEntryForm: React.FC<Props> = ({ initialEntry = null, onSave }) => {
  const dispatch = useDispatch<AppDispatch>();
  const paymentStatus = useSelector(
    (state: RootState) => state.settings.settings.paymentStatus
  );
  useSelector((state: RootState) => state.milk);
  const [saving, setSaving] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [milkTaken, setMilkTaken] = useState(true);
  const [quantity, setQuantity] = useState<number>(1);

  // If parent provides an initialEntry (from edit), pre-fill the form
  useEffect(() => {
    if (initialEntry) {
      if (initialEntry.date !== date) setDate(initialEntry.date);
      if (initialEntry.milkTaken !== milkTaken)
        setMilkTaken(initialEntry.milkTaken);
      if (initialEntry.quantity !== quantity)
        setQuantity(initialEntry.quantity);
    }
  }, [initialEntry]);

  // When the date changes, check for an existing entry and pre-fill the form
  useEffect(() => {
    const fetchEntryForDate = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("milk_entries")
          .select("*")
          .eq("user_id", user.id)
          .eq("entry_date", date)
          .maybeSingle();

        if (data) {
          setMilkTaken(Boolean(data.milk_taken));
          setQuantity(Number(data.quantity) || 1);
        } else {
          setMilkTaken(true);
          setQuantity(1);
        }
      } catch (err) {
        console.warn("Could not fetch entry for date:", err);
      }
    };

    const period = getMonthPeriod(new Date(date));
    if (paymentStatus[period] === "Paid") {
      setDisabled(true);
    } else {
      setDisabled(false);
    }

    // Only auto-fetch when there's no explicit initialEntry controlling the form
    if (!initialEntry) fetchEntryForDate();
  }, [date, initialEntry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalQuantity = milkTaken ? quantity : 0;
    setSaving(true);
    const dispatchResult = await dispatch(
      upsertMilkEntry({ date, milkTaken, quantity: finalQuantity })
    );

    // Check whether thunk was fulfilled
    type DispatchResultShape = {
      type?: string;
      payload?: MilkEntry;
      error?: { message?: string };
    };
    const res = dispatchResult as unknown as DispatchResultShape;
    const isFulfilled = !!res.type && res.type.endsWith("/fulfilled");
    const savedEntry = res.payload;

    if (isFulfilled) {
      // Notify parent and show success toast
      if (onSave) {
        onSave(savedEntry || { date, milkTaken, quantity: finalQuantity });
      }
      setSnackbar({ open: true, message: "Entry saved", severity: "success" });
    } else {
      // Show error toast
      const errMessage = res.error?.message || "Failed to save entry";
      setSnackbar({ open: true, message: errMessage, severity: "error" });
    }
    setSaving(false);
  };

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "info" | "warning" | "error";
  }>({ open: false, message: "", severity: "success" });

  const handleCloseSnackbar = (
    _event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <>
      <Typography variant="h6" className="font-semibold mb-4">
        {/* Daily Entry */}
      </Typography>
      <form onSubmit={handleSubmit}>
        {/* <Grid container spacing={3}> */}
        <Grid>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Date"
              value={date ? dayjs(date) : null}
              onChange={(newValue: Dayjs | null) => {
                if (newValue) setDate(newValue.format("YYYY-MM-DD"));
                else setDate("");
              }}
              format="DD-MM-YYYY"
              slotProps={{ textField: { fullWidth: true } }}
            />
          </LocalizationProvider>
        </Grid>
        <Grid>
          <FormControlLabel
            control={
              <Checkbox
                checked={milkTaken}
                onChange={(e) => setMilkTaken(e.target.checked)}
              />
            }
            label="Milk Taken"
          />
        </Grid>
        <Grid>
          <FormControl fullWidth disabled={!milkTaken}>
            <InputLabel id="quantity-label">Quantity</InputLabel>
            <Select
              labelId="quantity-label"
              id="quantity"
              value={quantity}
              label="Quantity"
              onChange={(e) => setQuantity(Number(e.target.value))}
            >
              <MenuItem value={0.25}>0.25 L</MenuItem>
              <MenuItem value={0.5}>0.5 L</MenuItem>
              <MenuItem value={0.75}>0.75 L</MenuItem>
              <MenuItem value={1}>1 L</MenuItem>
              <MenuItem value={1.25}>1.25 L</MenuItem>
              <MenuItem value={1.5}>1.5 L</MenuItem>
              <MenuItem value={1.75}>1.75 L</MenuItem>
              <MenuItem value={2}>2 L</MenuItem>
              <MenuItem value={2.25}>2.25 L</MenuItem>
              <MenuItem value={2.5}>2.5 L</MenuItem>
              <MenuItem value={2.75}>2.75 L</MenuItem>
              <MenuItem value={3}>3 L</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid className="mt-4">
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            disabled={saving || disabled}
            startIcon={saving ? <CircularProgress size={20} /> : null}
          >
            {saving ? "Saving..." : "Save Entry"}
          </Button>
          <hr className="mt-4 w-full border-gray-200" />
        </Grid>
        {/* </Grid> */}
      </form>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default DailyEntryForm;
