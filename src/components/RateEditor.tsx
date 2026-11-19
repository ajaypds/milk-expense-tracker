import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { fetchSettings, addMilkRate } from "../store/settingsSlice";
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Box,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/en-gb";

const RateEditor: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { settings, loading } = useSelector((state: RootState) => state.settings);

  const [newRate, setNewRate] = useState<number | string>(settings.milkRate || 55);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  useEffect(() => {
    if (settings.milkRate) {
      setNewRate(settings.milkRate);
    }
  }, [settings.milkRate]);

  const handleSaveRate = async () => {
    const rateVal = Number(newRate);
    if (!rateVal || rateVal <= 0) {
      setErrorMsg("Please enter a valid rate greater than 0.");
      return;
    }
    if (!effectiveFrom) {
      setErrorMsg("Please choose an effective date.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    try {
      await dispatch(addMilkRate({ rate: rateVal, effectiveFrom })).unwrap();
      setSuccessMsg(`Rate of ₹${rateVal}/L with effective date ${effectiveFrom} saved!`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save rate");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !settings.milkRate) {
    return (
      <Box display="flex" justifyContent="center" className="py-8">
        <CircularProgress />
      </Box>
    );
  }

  const rateHistory = settings.rateHistory || [];

  return (
    <Card elevation={1}>
      <CardContent>
        <Box className="flex justify-between items-center mb-4">
          <div>
            <Typography variant="h6" component="h2" className="font-semibold">
              Manage Milk Rate
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Configure current price and track historical rate changes with effective dates.
            </Typography>
          </div>
          <Chip
            label={`Current: ₹${settings.milkRate}/L`}
            color="primary"
            variant="filled"
            className="font-bold"
          />
        </Box>

        {successMsg && (
          <Alert severity="success" className="mb-4">
            {successMsg}
          </Alert>
        )}
        {errorMsg && (
          <Alert severity="error" className="mb-4">
            {errorMsg}
          </Alert>
        )}

        {/* Add New Rate Form */}
        <Box className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-6">
          <Typography variant="subtitle2" className="font-semibold mb-3">
            Add / Update Rate with Effective Date
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                id="milkRate"
                label="New Rate (₹ per liter)"
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                variant="outlined"
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
                <DatePicker
                  label="Effective From"
                  value={effectiveFrom ? dayjs(effectiveFrom) : null}
                  onChange={(date: Dayjs | null) => {
                    if (date) {
                      setEffectiveFrom(date.format("YYYY-MM-DD"));
                    }
                  }}
                  slotProps={{ textField: { size: "small", fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveRate}
                disabled={saving}
                fullWidth
                size="medium"
              >
                {saving ? <CircularProgress size={24} /> : "Save Rate"}
              </Button>
            </Grid>
          </Grid>
          <Typography variant="caption" className="block text-gray-500 dark:text-gray-400 mt-2">
            ℹ️ Changing the rate will never modify past paid months. Past paid periods retain their frozen snapshot rate.
          </Typography>
        </Box>

        {/* Rate History Table */}
        <Typography variant="subtitle2" className="font-semibold mb-2">
          Rate History
        </Typography>
        {rateHistory.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            No past rate records found.
          </Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell className="font-semibold">Rate (₹/L)</TableCell>
                  <TableCell className="font-semibold">Effective From</TableCell>
                  <TableCell className="font-semibold">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rateHistory.map((item, idx) => (
                  <TableRow key={item.id || idx}>
                    <TableCell className="font-bold text-blue-600 dark:text-blue-400">
                      ₹{item.rate}
                    </TableCell>
                    <TableCell>{dayjs(item.effective_from).format("DD/MM/YYYY")}</TableCell>
                    <TableCell>
                      {idx === 0 ? (
                        <Chip label="Active" size="small" color="success" variant="outlined" />
                      ) : (
                        <Chip label="Historical" size="small" variant="outlined" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default RateEditor;