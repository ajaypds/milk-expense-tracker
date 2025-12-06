import React, { useEffect, useMemo } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { ThemeProvider, useAppTheme } from "./context/ThemeContext";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import PrivateRoute from "./components/PrivateRoute";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase/config";
import { StatusBar, Style } from "@capacitor/status-bar";

const AppContent: React.FC = () => {
  const { mode } = useAppTheme();
  const [user] = useAuthState(auth);

  useEffect(() => {
    const applyStatusBarStyle = async () => {
      try {
        if (mode === "dark") {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: "#1e293b" }); // Slate 800 (Matching Navbar/Paper)
        } else {
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: "#ffffff" });
        }
        await StatusBar.setOverlaysWebView({ overlay: false });
      } catch (e) {
        console.warn("StatusBar plugin error", e);
      }
    };
    applyStatusBarStyle();
  }, [mode]);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const backButtonListener = CapacitorApp.addListener("backButton", () => {
      if (location.pathname === "/" || location.pathname === "/login") {
        CapacitorApp.exitApp();
      } else {
        navigate(-1);
      }
    });

    return () => {
      backButtonListener.then((listener) => listener.remove());
    };
  }, [navigate, location]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === "dark"
            ? {
                background: {
                  default: "#0f172a", // Slate 900
                  paper: "#1e293b", // Slate 800
                },
              }
            : {}),
        },
      }),
    [mode]
  );

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <div className="mx-auto h-screen flex flex-col overflow-hidden">
        {user && <Navbar />}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <HomePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <SettingsPage />
                </PrivateRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </MuiThemeProvider>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
