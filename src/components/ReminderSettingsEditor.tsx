import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { updateReminderSettings } from "../store/settingsSlice";
import { notificationService } from "../services/notificationService";
import {
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
} from "@mui/material";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import SendIcon from "@mui/icons-material/Send";

const ReminderSettingsEditor: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { settings } = useSelector((state: RootState) => state.settings);

  const [enabled, setEnabled] = useState<boolean>(settings.dailyReminderEnabled ?? true);
  const [time, setTime] = useState<string>(settings.dailyReminderTime || "20:30");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (settings.dailyReminderEnabled !== undefined) {
      setEnabled(settings.dailyReminderEnabled);
    }
    if (settings.dailyReminderTime) {
      setTime(settings.dailyReminderTime);
    }
  }, [settings.dailyReminderEnabled, settings.dailyReminderTime]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await dispatch(updateReminderSettings({ enabled, time })).unwrap();
      // Also register or cancel with local notifications service
      await notificationService.scheduleDailyReminder(time, enabled);
      setMessage({ type: "success", text: "Reminder settings saved successfully!" });
    } catch (err: unknown) {
      console.error(err);
      setMessage({ type: "error", text: "Failed to save reminder settings." });
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const sent = await notificationService.sendTestNotification();
      if (sent) {
        setMessage({
          type: "success",
          text: "Test notification dispatched! Check your notification tray.",
        });
      } else {
        setMessage({
          type: "error",
          text: "Could not send notification. Please ensure permissions are granted.",
        });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ type: "error", text: "Error sending test notification." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card variant="outlined" className="mb-6 rounded-2xl">
      <CardContent>
        <Box className="flex items-center gap-2 mb-2">
          <NotificationsActiveIcon color="primary" />
          <Typography variant="h6" className="font-bold">
            Daily Milk Reminders
          </Typography>
        </Box>
        <Typography variant="body2" color="textSecondary" className="mb-4">
          Receive a local notification on your phone or browser to remind you to log today's milk delivery.
        </Typography>

        {message && (
          <Alert severity={message.type} className="mb-4" onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Box className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body1" className="font-medium">
                {enabled ? "Daily Reminder Active" : "Daily Reminder Paused"}
              </Typography>
            }
          />

          <TextField
            label="Reminder Time"
            type="time"
            size="small"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!enabled}
            slotProps={{
              inputLabel: { shrink: true },
            }}
            sx={{ width: { xs: "100%", sm: 160 } }}
          />
        </Box>

        <Box className="flex flex-wrap gap-2 justify-end">
          <Button
            variant="outlined"
            size="small"
            startIcon={testing ? <CircularProgress size={16} /> : <SendIcon />}
            onClick={handleTestNotification}
            disabled={testing}
            sx={{ textTransform: "none" }}
          >
            Send Test Alert
          </Button>

          <Button
            variant="contained"
            size="small"
            onClick={handleSave}
            disabled={saving}
            sx={{ textTransform: "none" }}
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ReminderSettingsEditor;
