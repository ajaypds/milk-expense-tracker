import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabase/client";
import { Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import {
  Container,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Box,
  TextField,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import LockResetIcon from "@mui/icons-material/LockReset";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

const LoginPage: React.FC = () => {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRegistering] = useState(false);

  // Forgot Password / Reset Dialog State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetEmail, setResetEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [fromRecoveryLink, setFromRecoveryLink] = useState(false);

  // Listen for recovery links (e.g. from web email clicks)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setForgotModalOpen(true);
        setResetStep(2);
        setFromRecoveryLink(true);
        setResetSuccess("Valid reset link detected! Please enter your new password below.");
      }
    });

    // Also check if URL contains an error from an expired link
    if (window.location.hash.includes("error_code=otp_expired")) {
      setError(
        "The email link has expired or was already used. Use the 'Forgot Password?' button below to receive a fresh 6-digit code."
      );
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        setError(error.message);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred during Google sign-in.");
      }
      console.error("Error signing in with Google:", error);
    }
  };

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) setError(error.message);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) setError(error.message);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred.");
      }
      console.error("Error with email/password auth:", error);
    }
  };

  const handleSendResetCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!resetEmail) {
      setResetError("Please enter your email address.");
      return;
    }
    setResetLoading(true);
    setResetError("");
    setResetSuccess("");
    try {
      const redirectUrl = Capacitor.isNativePlatform()
        ? "milkexpense://login"
        : window.location.origin.includes("localhost")
        ? window.location.origin
        : "https://milkmanager-c700b.firebaseapp.com";

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      setResetSuccess(
        "Verification code sent! Please check your email for the 6-digit code or link."
      );
      setResetStep(2);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setResetError(err.message);
      } else {
        setResetError("Failed to send reset code. Please check your email address.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyAndUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setResetError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setResetLoading(true);
    setResetError("");
    setResetSuccess("");

    try {
      if (!fromRecoveryLink) {
        if (!otpCode || otpCode.trim().length < 6) {
          setResetError("Please enter the 6-digit code sent to your email.");
          setResetLoading(false);
          return;
        }

        // 1. Verify 6-digit OTP token
        const { error: otpError } = await supabase.auth.verifyOtp({
          email: resetEmail.trim(),
          token: otpCode.trim(),
          type: "recovery",
        });
        if (otpError) throw otpError;
      }

      // 2. Set new password for the authenticated recovery session
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      setResetSuccess("Password successfully updated! Logging you in...");
      setTimeout(() => {
        setForgotModalOpen(false);
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setResetError(err.message);
      } else {
        setResetError("Failed to update password. Please check the code and try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const openForgotModal = () => {
    setResetEmail(email || "");
    setResetStep(1);
    setResetError("");
    setResetSuccess("");
    setFromRecoveryLink(false);
    setOtpCode("");
    setNewPassword("");
    setConfirmPassword("");
    setForgotModalOpen(true);
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (user) {
    return <Navigate to="/" />;
  }

  return (
    <Container
      component="main"
      maxWidth="xs"
      className="flex items-center justify-center min-h-screen"
    >
      <Paper elevation={3} className="p-8 flex flex-col items-center w-full rounded-2xl">
        <Typography component="h1" variant="h5" className="mb-2 font-bold">
          {isRegistering ? "Create Account" : "Sign In"}
        </Typography>
        <Typography
          component="p"
          variant="body2"
          color="textSecondary"
          className="mb-6 text-center"
        >
          Milk Expense Tracker
        </Typography>

        {error && (
          <Alert severity="error" className="w-full mb-4">
            {error}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleEmailPasswordSubmit}
          className="w-full"
        >
          <Box className="flex flex-col gap-4">
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
          </Box>

          <Box className="flex justify-end mt-2 mb-2">
            <Button
              variant="text"
              size="small"
              onClick={openForgotModal}
              sx={{ textTransform: "none", fontSize: "0.85rem", fontWeight: 500 }}
            >
              Forgot Password?
            </Button>
          </Box>

          <Button
            type="submit"
            fullWidth
            size="large"
            variant="contained"
            className="mt-2 mb-4"
            disabled={loading}
          >
            {loading ? (
              <CircularProgress size={24} />
            ) : isRegistering ? (
              "Register"
            ) : (
              "Sign In"
            )}
          </Button>
        </Box>

        <Divider className="w-full my-4">OR</Divider>

        <Button
          variant="outlined"
          startIcon={<GoogleIcon />}
          onClick={handleGoogleLogin}
          fullWidth
          disabled={loading}
        >
          Sign in with Google
        </Button>
      </Paper>

      {/* Forgot Password / Reset Modal */}
      <Dialog
        open={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle className="flex justify-between items-center pb-2">
          <Box className="flex items-center gap-2">
            <LockResetIcon color="primary" />
            <Typography variant="h6" className="font-bold">
              {resetStep === 1 ? "Reset Password" : "Set New Password"}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setForgotModalOpen(false)}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {resetStep === 1 ? (
          <Box component="form" onSubmit={handleSendResetCode}>
            <DialogContent dividers>
              <Typography variant="body2" color="textSecondary" className="mb-4">
                Enter your registered email address. We will send a secure link to reset your password.
              </Typography>

              {resetError && (
                <Alert severity="error" className="mb-4">
                  {resetError}
                </Alert>
              )}

              <TextField
                label="Registered Email"
                type="email"
                fullWidth
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoFocus
              />
            </DialogContent>

            <DialogActions className="px-6 py-3">
              <Button onClick={() => setForgotModalOpen(false)} color="inherit">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={resetLoading || !resetEmail}
              >
                {resetLoading ? <CircularProgress size={20} /> : "Send Reset Link"}
              </Button>
            </DialogActions>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleVerifyAndUpdatePassword}>
            <DialogContent dividers>
              <Typography variant="body2" color="textSecondary" className="mb-4">
                {fromRecoveryLink
                  ? "Choose a strong new password for your account."
                  : `Enter the 6-digit verification code sent to ${resetEmail} and your new password.`}
              </Typography>

              {resetSuccess && (
                <Alert
                  severity="success"
                  icon={<CheckCircleOutlineIcon />}
                  className="mb-4"
                >
                  {resetSuccess}
                </Alert>
              )}

              {resetError && (
                <Alert severity="error" className="mb-4">
                  {resetError}
                </Alert>
              )}

              <Box className="flex flex-col gap-3">
                {!fromRecoveryLink && (
                  <TextField
                    label="6-Digit Verification Code"
                    type="text"
                    fullWidth
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.trim())}
                    placeholder="e.g. 123456"
                    slotProps={{ htmlInput: { maxLength: 10 } }}
                    autoFocus
                  />
                )}

                <TextField
                  label="New Password"
                  type="password"
                  fullWidth
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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

              {!fromRecoveryLink && (
                <Box className="flex justify-between items-center mt-3">
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => {
                      setResetStep(1);
                      setResetError("");
                    }}
                    sx={{ textTransform: "none", fontSize: "0.8rem" }}
                  >
                    Change Email
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => handleSendResetCode()}
                    disabled={resetLoading}
                    sx={{ textTransform: "none", fontSize: "0.8rem" }}
                  >
                    Resend Code
                  </Button>
                </Box>
              )}
            </DialogContent>

            <DialogActions className="px-6 py-3">
              <Button onClick={() => setForgotModalOpen(false)} color="inherit">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={resetLoading || !newPassword || !confirmPassword}
              >
                {resetLoading ? <CircularProgress size={20} /> : "Update Password"}
              </Button>
            </DialogActions>
          </Box>
        )}
      </Dialog>
    </Container>
  );
};

export default LoginPage;
