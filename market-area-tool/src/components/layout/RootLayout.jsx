import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import {
  SunIcon,
  MoonIcon,
  HomeIcon,
  AdjustmentsHorizontalIcon,
  ArrowRightOnRectangleIcon,
  SwatchIcon,
  UserCircleIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";
import { Dialog } from "@headlessui/react";
import { logout, getApiUrl } from "../../utils/auth";
import { useProjectCleanup } from '../../hooks/useProjectCleanup';
import AdminPanel from "../../admin/AdminPanel";
import axios from 'axios';

export default function RootLayout() {
  const navigate = useNavigate();
  const cleanupProject = useProjectCleanup();
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const checkAdminStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      console.log('Current token:', token);

      if (token) {
        console.log('Making admin status request...');
        const baseUrl = getApiUrl();
        const response = await axios.get(`${baseUrl}/api/admin/users/me/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });
        console.log('Admin status response:', response.data);
        setIsAdmin(Boolean(response.data.is_staff));
        console.log('Is admin set to:', Boolean(response.data.is_staff));
      } else {
        console.log('No token found in localStorage');
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Failed to check admin status:", error?.response?.data || error.message);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      setShowLogoutConfirm(false);
      cleanupProject();
      await logout(navigate);
    } catch (error) {
      console.error("Logout failed:", error);
      localStorage.clear();
      navigate("/login", { replace: true });
    }
  };

  const handleHomeClick = (e) => {
    e.preventDefault();
    navigate("/");
  };

  const handleUsersClick = () => {
    setShowAdminPanel(true);
  };

  const handlePresetsClick = () => {
    navigate("/presets");
  };

  const handleManageColorClick = () => {
    navigate("/manage-preset-color");
  };

  if (loading) {
    return null; // Or return a loading spinner
  }

  return (
    <div className="min-h-screen h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      {showAdminPanel && (
        <AdminPanel isOpen={showAdminPanel} onClose={() => setShowAdminPanel(false)} />
      )}

      <header className="h-14 flex-none bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="rounded-full p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? (
                <MoonIcon className="h-5 w-5" />
              ) : (
                <SunIcon className="h-5 w-5" />
              )}
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={handleUsersClick}
                  className="flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors duration-200"
                >
                  <UserCircleIcon className="h-5 w-5" />
                  <span className="hidden sm:inline">Users</span>
                </button>
                <button
                  onClick={handlePresetsClick}
                  className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors duration-200"
                >
                  <DocumentIcon className="h-5 w-5" />
                  <span className="hidden sm:inline">Presets</span>
                </button>
                <button
                  onClick={handleManageColorClick}
                  className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-200"
                >
                  <SwatchIcon className="h-5 w-5" />
                  <span className="hidden sm:inline">Color</span>
                </button>
              </>
            )}
          </div>

          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-teal-400 px-4 py-1 rounded-lg">
              TCG Navigator
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleHomeClick}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              <HomeIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Home</span>
            </button>
            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors duration-200"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      <Dialog
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-lg max-w-sm w-full p-6 shadow-xl">
            <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
              Confirm Logout
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-gray-500 dark:text-gray-400">
              Are you sure you want to logout?
            </Dialog.Description>

            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                Logout
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}