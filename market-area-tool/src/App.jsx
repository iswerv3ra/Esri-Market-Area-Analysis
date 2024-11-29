// src/App.jsx

import React, { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  Outlet,
} from "react-router-dom";
import axios from "axios";

// Layout Components
import RootLayout from "./components/layout/RootLayout";

// Page Components
import ProjectsList from "./pages/ProjectsList";
import MarketAreasLayout from "./pages/MarketAreasLayout";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import CreateProject from "./pages/CreateProject";
import Presets from "./pages/Presets"; // Ensure correct import

// Providers
import { MarketAreaProvider } from "./contexts/MarketAreaContext";
import { MapProvider } from "./contexts/MapContext";

// Auth Utilities
import {
  setupAxiosInterceptors,
  isAuthenticated,
  setAuthToken,
  verifyToken,
} from "./utils/auth";

// Loading Component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
  </div>
);

// Protected Route Component
const ProtectedRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        setIsChecking(false);
        return;
      }

      try {
        setAuthToken(token);
        const valid = await verifyToken(token);
        setIsValid(valid);
      } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [navigate]);

  if (isChecking) {
    return <LoadingSpinner />;
  }

  if (!isValid) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

function App() {
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      const cleanup = setupAxiosInterceptors(navigate);

      try {
        const token = localStorage.getItem("accessToken");
        if (token) {
          setAuthToken(token);
          const isValid = await verifyToken(token);

          if (!isValid) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            navigate("/login");
          }
        }
      } catch (error) {
        console.error("Initialization error:", error);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } finally {
        setIsInitializing(false);
      }

      return cleanup;
    };

    initializeApp();
  }, [navigate]);

  if (isInitializing) {
    return <LoadingSpinner />;
  }

  return (
    <MapProvider>
      <MarketAreaProvider>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              isAuthenticated() ? <Navigate to="/" replace /> : <Login />
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated() ? <Navigate to="/" replace /> : <Register />
            }
          />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<RootLayout />}>
              {/* Nested Routes */}
              <Route index element={<ProjectsList />} />
              <Route path="projects/create" element={<CreateProject />} />
              <Route
                path="projects/:projectId/market-areas"
                element={<MarketAreasLayout />}
              />

              {/* **Top-Level Presets Route** */}
              <Route
                path="presets"
                element={<Presets />}
              />

              {/* Catch-all Redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </MarketAreaProvider>
    </MapProvider>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center px-4 py-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Something went wrong
            </h2>
            <button
              onClick={() => {
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                window.location.href = "/login";
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 
                       focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Return to Login
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const AppWithErrorBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

export default AppWithErrorBoundary;
