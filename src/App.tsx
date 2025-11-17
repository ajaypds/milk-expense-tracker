import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import PrivateRoute from "./components/PrivateRoute";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase/config";
import { StatusBar, Style } from "@capacitor/status-bar";

const App: React.FC = () => {
  const [user] = useAuthState(auth);

  useEffect(() => {
    StatusBar.setStyle({ style: Style.Light });
    StatusBar.setBackgroundColor({ color: "#ffffff" });
    StatusBar.setOverlaysWebView({ overlay: false });
  }, []);

  return (
    <div className="mx-auto pt-8">
      {user && <Navbar />}
      <main>
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
  );
};

export default App;
