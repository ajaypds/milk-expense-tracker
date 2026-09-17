import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { updateCycleStartDay } from "../store/settingsSlice";
import {
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Box,
  Alert,
  CircularProgress,
} from "@mui/material";

const BillingCycleEditor: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const cycleStartDay = useSelector(
    (state: RootState) => state.settings.settings.cycleStartDay ?? 10
  );

  const [selectedDay, setSelectedDay] = useState<number>(cycleStartDay);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const handleSave = async () => {
    setSaving(true);
    try {
      await dispatch(updateCycleStartDay(selectedDay)).unwrap();
      setSavedMsg(`Billing cycle start day set to ${selectedDay}th of each month.`);
      setTimeout(() => setSavedMsg(""), 4000);
    } catch (err) {
      console.error("Failed to update cycle start day", err);
    } finally {
      setSaving(false);
    }
  };

  // Popular cycle options: 1st (standard month), 5th, 10th (default), 15th, 20th
  const dayOptions = [1, 5, 10, 15, 20, 25];

  return (
    <Card elevation={1}>
      <CardContent>
        <Typography variant="h6" component="h2" className="font-semibold mb-1">
          Billing Cycle Setting
        </Typography>
        <Typography variant="body2" color="textSecondary" className="mb-4">
          Choose the day of the month your billing cycle begins. (Default is the 10th: 10th of previous month to 9th of current month).
        </Typography>

        {savedMsg && (
          <Alert severity="success" className="mb-4">
            {savedMsg}
          </Alert>
        )}

        <Box className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="cycle-day-label">Cycle Start Day</InputLabel>
            <Select
              labelId="cycle-day-label"
              id="cycleStartDay"
              value={selectedDay}
              label="Cycle Start Day"
              onChange={(e) => setSelectedDay(Number(e.target.value))}
            >
              {dayOptions.map((day) => (
                <MenuItem key={day} value={day}>
                  {day === 1 ? "1st (1st → End of Month)" : `${day}th (${day}th → ${day - 1}th)`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={saving || selectedDay === cycleStartDay}
          >
            {saving ? <CircularProgress size={24} /> : "Save Cycle Day"}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default BillingCycleEditor;
