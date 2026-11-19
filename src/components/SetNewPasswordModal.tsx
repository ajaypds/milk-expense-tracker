import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabase/client";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

const SetNewPasswordModal: React.FC = () => {
  const { isPasswordRecovery, setIsPasswordRecovery } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!isPasswordRecovery) return null;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setSuccess("Your new password has been saved successfully!");
      // Clean up URL hash so reload doesn't trigger recovery again
      try {
        if (window.location.hash) {
          window.history.replaceState(null, "", window.location.pathname);
        }
      } catch {
        // ignore
      }

      setTimeout(() => {
        setIsPasswordRecovery(false);
        setNewPassword("");
        setConfirmPassword("");
        setSuccess("");
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to update password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsPasswordRecovery(false);
    try {
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch {
      // ignore
    }
  };

  return (
    <Dialog open={isPasswordRecovery} maxWidth="xs" fullWidth>
      <DialogTitle className="flex items-center gap-2">
        <LockResetIcon color="primary" />
        <Typography variant="h6" className="font-bold">
          Set New Password
        </Typography>
      </DialogTitle>

      <Box component="form" onSubmit={handleUpdatePassword}>
        <DialogContent dividers>
          <Typography variant="body2" color="textSecondary" className="mb-4">
            You accessed your account via a password reset link. Please create your new password below.
          </Typography>

          {success && (
            <Alert severity="success" icon={<CheckCircleOutlineIcon />} className="mb-4">
              {success}
            </Alert>
          )}

          {error && (
            <Alert severity="error" className="mb-4">
              {error}
            </Alert>
          )}

          <Box className="flex flex-col gap-3">
            <TextField
              label="New Password"
              type="password"
              fullWidth
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoFocus
              helperText="Minimum 6 characters"
            />

            <TextField
              label="Confirm New Password"
              type="password"
              fullWidth
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Box>
        </DialogContent>

        <DialogActions className="px-6 py-3 flex justify-between">
          <Button onClick={handleDismiss} color="inherit" disabled={loading}>
            Skip for Now
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !newPassword || !confirmPassword}
          >
            {loading ? <CircularProgress size={20} /> : "Save New Password"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default SetNewPasswordModal;
