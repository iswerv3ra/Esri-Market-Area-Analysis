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
import Presets from "./pages/Presets";
import ManagePresetColor from "./pages/ManagePresetColor";

// Providers
import { MarketAreaProvider, useMarketAreas } from "./contexts/MarketAreaContext";
import { MapProvider } from "./contexts/MapContext";
import { PresetsProvider } from "./contexts/PresetsContext";

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
      try {
        const token = localStorage.getItem("accessToken");
        const refreshToken = localStorage.getItem("refreshToken");

        // More comprehensive authentication check
        if (!token || !refreshToken) {
          setIsChecking(false);
          setIsValid(false);
          return;
        }

        // Set auth token for verification
        setAuthToken(token);

        // Verify token
        const valid = await verifyToken(token);
        
        console.group('Authentication Check');
        console.log('Token Verification Result:', valid);
        console.log('Access Token:', !!token);
        console.log('Refresh Token:', !!refreshToken);
        console.groupEnd();

        setIsValid(valid);
      } catch (error) {
        console.error("Comprehensive Auth Check Error:", {
          error,
          accessToken: !!localStorage.getItem("accessToken"),
          refreshToken: !!localStorage.getItem("refreshToken")
        });
        
        // Clear tokens on verification failure
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setIsValid(false);
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

// Main App Component
function App() {
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      // Setup axios interceptors
      const cleanup = setupAxiosInterceptors(navigate);

      try {
        const token = localStorage.getItem("accessToken");
        const refreshToken = localStorage.getItem("refreshToken");

        // More robust initialization check
        if (token && refreshToken) {
          setAuthToken(token);
          
          console.group('App Initialization');
          console.log('Attempting Token Verification');
          
          const isValid = await verifyToken(token);
          
          console.log('Token Verification Result:', isValid);
          console.groupEnd();

          if (!isValid) {
            console.log('Token Invalid - Clearing credentials');
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            navigate("/login");
          }
        }
      } catch (error) {
        console.error("Comprehensive Initialization Error:", {
          error,
          accessToken: !!localStorage.getItem("accessToken"),
          refreshToken: !!localStorage.getItem("refreshToken")
        });
        
        // Comprehensive error handling
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
    <MarketAreaProvider>
      <InnerApp />
    </MarketAreaProvider>
  );
}

// Inner App Component
function InnerApp() {
  const { marketAreas } = useMarketAreas();

  return (
    <MapProvider marketAreas={marketAreas}>
      <PresetsProvider>
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
              <Route index element={<ProjectsList />} />
              <Route path="projects/create" element={<CreateProject />} />
              <Route
                path="projects/:projectId/market-areas"
                element={<MarketAreasLayout />}
              />
              <Route path="presets" element={<Presets />} />
              <Route path="manage-preset-color" element={<ManagePresetColor />} />

              {/* Catch-all Redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </PresetsProvider>
    </MapProvider>
  );
}

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Comprehensive Error Boundary Catch:", {
      error,
      errorInfo,
      location: window.location.href
    });
    this.setState({ 
      error, 
      errorInfo 
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center px-4 py-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              An unexpected error occurred. Please try again.
            </p>
            <div className="mb-4">
              <pre className="text-red-500 text-sm overflow-x-auto">
                {this.state.error && this.state.error.toString()}
              </pre>
            </div>
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