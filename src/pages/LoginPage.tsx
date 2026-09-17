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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
  Tabs,
  Tab,
} from "@mui/material";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import LockResetIcon from "@mui/icons-material/LockReset";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

const LoginPage: React.FC = () => {
  const { user, loading } = useAuth();
  const [tabIndex, setTabIndex] = useState<number>(0); // 0 = Sign In, 1 = Register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  // Forgot Password / Reset Dialog State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetEmail, setResetEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
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

    if (window.location.hash.includes("error_code=otp_expired")) {
      setError(
        "The email link has expired or was already used. Use the 'Forgot Password?' button below to request a fresh link."
      );
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setFormLoading(true);

    try {
      if (tabIndex === 1) {
        // Register Mode
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          setFormLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setFormLoading(false);
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpError) throw signUpError;

        if (data.session) {
          // Auto signed in
        } else {
          setInfoMessage("Registration successful! Please check your email to confirm your account.");
        }
      } else {
        // Sign In Mode
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) throw signInError;
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred during authentication.");
      }
      console.error("Auth error:", err);
    } finally {
      setFormLoading(false);
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
        "Password reset link sent! Please check your email inbox and click the link to set your new password."
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        setResetError(err.message);
      } else {
        setResetError("Failed to send reset link. Please check your email address.");
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
    if (newPassword !== confirmNewPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setResetLoading(true);
    setResetError("");
    setResetSuccess("");

    try {
      if (!fromRecoveryLink) {
        if (!otpCode || otpCode.trim().length < 6) {
          setResetError("Please enter the 6-digit code or click the email link.");
          setResetLoading(false);
          return;
        }

        const { error: otpError } = await supabase.auth.verifyOtp({
          email: resetEmail.trim(),
          token: otpCode.trim(),
          type: "recovery",
        });
        if (otpError) throw otpError;
      }

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
        setResetError("Failed to update password. Please try again.");
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
    setConfirmNewPassword("");
    setForgotModalOpen(true);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (user) {
    return <Navigate to="/" />;
  }

  return (
    <Container component="main" maxWidth="xs" className="flex items-center justify-center min-h-screen py-8 px-4">
      <Paper
        elevation={3}
        className="p-6 sm:p-8 flex flex-col items-center w-full rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900"
      >
        {/* Brand Icon Header */}
        <Box className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center mb-3 shadow-inner">
          <span className="text-3xl select-none">🥛</span>
        </Box>

        <Typography component="h1" variant="h5" className="font-extrabold text-slate-900 dark:text-white tracking-tight">
          Milk Expense Tracker
        </Typography>
        <Typography variant="body2" color="textSecondary" className="mb-5 text-center">
          {tabIndex === 0
            ? "Welcome back! Sign in to manage your daily milk logs."
            : "Create an account to start tracking your deliveries."}
        </Typography>

        {/* Tab Switcher: Sign In vs Register */}
        <Box className="w-full mb-5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <Tabs
            value={tabIndex}
            onChange={(_e, val) => {
              setTabIndex(val);
              setError("");
              setInfoMessage("");
            }}
            variant="fullWidth"
            textColor="primary"
            indicatorColor="primary"
            sx={{
              minHeight: 40,
              "& .MuiTab-root": {
                minHeight: 40,
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.9rem",
                borderRadius: "10px",
                transition: "all 0.2s",
              },
              "& .Mui-selected": {
                backgroundColor: "background.paper",
                boxShadow: 1,
              },
              "& .MuiTabs-indicator": {
                display: "none",
              },
            }}
          >
            <Tab label="Sign In" />
            <Tab label="Create Account" />
          </Tabs>
        </Box>

        {error && (
          <Alert severity="error" className="w-full mb-4 rounded-xl" onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {infoMessage && (
          <Alert severity="info" className="w-full mb-4 rounded-xl" onClose={() => setInfoMessage("")}>
            {infoMessage}
          </Alert>
        )}

        {/* Auth Form */}
        <Box component="form" onSubmit={handleEmailPasswordSubmit} className="w-full">
          <Box className="flex flex-col gap-3.5">
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoFocus
              placeholder="you@example.com"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              placeholder="••••••••"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                        aria-label="toggle password visibility"
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* Confirm Password (only in Register mode) */}
            {tabIndex === 1 && (
              <TextField
                label="Confirm Password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                fullWidth
                placeholder="••••••••"
                helperText="Must be at least 6 characters"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          edge="end"
                          aria-label="toggle password visibility"
                        >
                          {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            )}
          </Box>

          {/* Forgot Password Link (Sign In mode only) */}
          {tabIndex === 0 && (
            <Box className="flex justify-end mt-2 mb-2">
              <Button
                variant="text"
                size="small"
                onClick={openForgotModal}
                sx={{
                  textTransform: "none",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "primary.main",
                  p: 0.5,
                }}
              >
                Forgot Password?
              </Button>
            </Box>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            fullWidth
            size="large"
            variant="contained"
            className="mt-3 mb-2 py-3 rounded-xl font-bold text-base shadow-md transition-all"
            disabled={formLoading}
            endIcon={!formLoading && <ArrowForwardIcon />}
            sx={{
              textTransform: "none",
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
            }}
          >
            {formLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : tabIndex === 0 ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </Button>
        </Box>

        {/* Bottom Switcher Prompt */}
        <Box className="mt-4 text-center">
          <Typography variant="body2" color="textSecondary">
            {tabIndex === 0 ? "Don't have an account? " : "Already have an account? "}
            <Button
              variant="text"
              size="small"
              onClick={() => {
                setTabIndex((prev) => (prev === 0 ? 1 : 0));
                setError("");
                setInfoMessage("");
              }}
              sx={{ textTransform: "none", fontWeight: 700, p: 0 }}
            >
              {tabIndex === 0 ? "Sign Up" : "Sign In"}
            </Button>
          </Typography>
        </Box>
      </Paper>

      {/* Forgot Password Dialog */}
      <Dialog
        open={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            className: "rounded-2xl p-2",
          },
        }}
      >
        <DialogTitle className="flex justify-between items-center pb-2">
          <Box className="flex items-center gap-2">
            <LockResetIcon color="primary" />
            <Typography variant="h6" className="font-bold">
              {resetStep === 1 ? "Reset Password" : "Set New Password"}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setForgotModalOpen(false)} aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {resetStep === 1 ? (
          <Box component="form" onSubmit={handleSendResetCode}>
            <DialogContent dividers>
              <Typography variant="body2" color="textSecondary" className="mb-4">
                Enter your registered email address. We will send a secure link to reset your password.
              </Typography>

              {resetSuccess && (
                <Alert severity="success" icon={<CheckCircleOutlineIcon />} className="mb-4 rounded-xl">
                  {resetSuccess}
                </Alert>
              )}

              {resetError && (
                <Alert severity="error" className="mb-4 rounded-xl">
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
                placeholder="name@example.com"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlinedIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </DialogContent>

            <DialogActions className="px-6 py-3">
              <Button onClick={() => setForgotModalOpen(false)} color="inherit" sx={{ textTransform: "none" }}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={resetLoading || !resetEmail}
                sx={{ textTransform: "none", fontWeight: 600 }}
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
                  : `Enter the verification code or use the link sent to ${resetEmail}.`}
              </Typography>

              {resetSuccess && (
                <Alert severity="success" icon={<CheckCircleOutlineIcon />} className="mb-4 rounded-xl">
                  {resetSuccess}
                </Alert>
              )}

              {resetError && (
                <Alert severity="error" className="mb-4 rounded-xl">
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
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                />
              </Box>
            </DialogContent>

            <DialogActions className="px-6 py-3">
              <Button onClick={() => setForgotModalOpen(false)} color="inherit" sx={{ textTransform: "none" }}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={resetLoading || !newPassword || !confirmNewPassword}
                sx={{ textTransform: "none", fontWeight: 600 }}
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
