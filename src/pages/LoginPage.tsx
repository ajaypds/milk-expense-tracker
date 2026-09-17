import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabase/client";
import { Navigate } from "react-router-dom";
import {
  Container,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Box,
  TextField,
  Grid,
  Alert,
  Divider,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";

const LoginPage: React.FC = () => {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRegistering] = useState(false);

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
      <Paper elevation={3} className="p-8 flex flex-col items-center w-full">
        <Typography component="h1" variant="h5" className="mb-2">
          {isRegistering ? "Create Account" : "Sign In"}
        </Typography>
        <Typography
          component="p"
          variant="body2"
          className="text-gray-600 mb-6"
        >
          {/* to manage your milk expenses */}
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
          <Grid>
            <Grid className="mb-4">
              <TextField
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                autoFocus
              />
            </Grid>
            <Grid className="mb-4">
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
              />
            </Grid>
          </Grid>
          <Button
            type="submit"
            fullWidth
            size="large"
            variant="contained"
            className="mt-6 mb-4"
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
          <Grid container justifyContent="flex-end">
            {/* <Grid>
              <Link
                href="#"
                variant="body2"
                onClick={(e) => {
                  e.preventDefault();
                  setIsRegistering(!isRegistering);
                  setError("");
                }}
              >
                {isRegistering
                  ? "Already have an account? Sign in"
                  : "Don't have an account? Sign Up"}
              </Link>
            </Grid> */}
          </Grid>
        </Box>

        <Divider className="w-full my-6">OR</Divider>

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
    </Container>
  );
};

export default LoginPage;
