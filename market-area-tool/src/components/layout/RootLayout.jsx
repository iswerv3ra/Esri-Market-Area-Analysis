import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import {
  SunIcon,
  MoonIcon,
  HomeIcon,
  AdjustmentsHorizontalIcon,
  ArrowRightOnRectangleIcon,
  SwatchIcon, // Added for "Manage Preset Colors"
} from "@heroicons/react/24/outline";
import { Dialog } from "@headlessui/react";
import { logout } from "../../utils/auth";
import { useProjectCleanup } from '../../hooks/useProjectCleanup';

export default function RootLayout() {
  const navigate = useNavigate();
  const cleanupProject = useProjectCleanup();
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      setShowLogoutConfirm(false);
      cleanupProject(); // Clean up before logout
      await logout(navigate);
    } catch (error) {
      console.error("Logout failed:", error);
      localStorage.clear();
      navigate("/login", { replace: true });
    }
  };

  const handleHomeClick = (e) => {
    e.preventDefault(); // Prevent default Link behavior
    cleanupProject();
    navigate("/");
  };

  return (
    <div className="min-h-screen h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      <header className="h-14 flex-none bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center">
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
          </div>

          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-teal-400 px-4 py-1 rounded-lg">
              Market Area Definition Tool
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              to="/presets"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Variables</span>
            </Link>

            {/* New link for Manage Preset Colors */}
            <Link
              to="/manage-preset-color"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              <SwatchIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Colors</span>
            </Link>

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
