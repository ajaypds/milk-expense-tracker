import React, { useEffect, useMemo } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { ThemeProvider, useAppTheme } from "./context/ThemeContext";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import ReportsPage from "./pages/ReportsPage";
import LoginPage from "./pages/LoginPage";
import PrivateRoute from "./components/PrivateRoute";
import SetNewPasswordModal from "./components/SetNewPasswordModal";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { StatusBar, Style } from "@capacitor/status-bar";
import { supabase } from "./supabase/client";

const AppContent: React.FC = () => {
  const { mode } = useAppTheme();
  const { user, setIsPasswordRecovery } = useAuth();

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

    const handleDeepLinkUrl = async (urlStr: string) => {
      console.log("Deep link opened:", urlStr);
      try {
        if (
          urlStr.includes("milkexpense://") ||
          urlStr.includes("milkmanager-c700b.web.app") ||
          urlStr.includes("milkmanager-c700b.firebaseapp.com")
        ) {
          const hashIdx = urlStr.indexOf("#");
          const searchIdx = urlStr.indexOf("?");

          // 1. Mark recovery state if recovery flow is present
          if (urlStr.includes("type=recovery")) {
            setIsPasswordRecovery(true);
          }

          // 2. Process hash fragments (#access_token=...&refresh_token=...)
          if (hashIdx !== -1) {
            const hash = urlStr.substring(hashIdx);
            window.location.hash = hash;
            const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
            const accessToken = hashParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token");

            if (accessToken && refreshToken) {
              const { data: sessionData, error: sessionErr } =
                await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });

              if (!sessionErr && sessionData?.session) {
                if (urlStr.includes("type=recovery")) {
                  navigate("/login");
                } else {
                  navigate("/");
                }
                return;
              }
            }
          }

          // 3. Process PKCE query parameters (?code=...)
          if (searchIdx !== -1) {
            const search = urlStr.substring(searchIdx).split("#")[0];
            const searchParams = new URLSearchParams(search);
            const code = searchParams.get("code");
            if (code) {
              const { data: sessionData, error: codeErr } =
                await supabase.auth.exchangeCodeForSession(code);
              if (!codeErr && sessionData?.session) {
                if (urlStr.includes("type=recovery")) {
                  navigate("/login");
                } else {
                  navigate("/");
                }
                return;
              }
            }
          }

          navigate("/login");
        }
      } catch (err) {
        console.warn("Error processing deep link URL:", err);
      }
    };

    // Cold launch deep link check
    CapacitorApp.getLaunchUrl().then((launchUrl) => {
      if (launchUrl?.url) {
        handleDeepLinkUrl(launchUrl.url);
      }
    });

    // Warm launch deep link listener
    const appUrlOpenListener = CapacitorApp.addListener("appUrlOpen", (data) => {
      handleDeepLinkUrl(data.url);
    });

    return () => {
      backButtonListener.then((listener) => listener.remove());
      appUrlOpenListener.then((listener) => listener.remove());
    };
  }, [navigate, location, setIsPasswordRecovery]);

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
      <SetNewPasswordModal />
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
              path="/reports"
              element={
                <PrivateRoute>
                  <ReportsPage />
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
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
