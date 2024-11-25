import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { SunIcon, MoonIcon, HomeIcon, AdjustmentsHorizontalIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { Dialog } from '@headlessui/react';

export default function RootLayout() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem('theme') === 'dark'
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-container">
      {/* Main Header */}
      <header className="app-header bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 flex items-center justify-between h-14">
          {/* Left Section: Dark Mode Toggle */}
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

          {/* Center Section: Title */}
          <div className="flex-grow flex justify-center">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white ml-3 transform translate-x-1">
              Market Area Definition Tool
            </h1>
          </div>

          {/* Right Section: Navigation and Logout */}
          <div className="flex items-center space-x-4">
            <Link
              to="/presets"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
              <span>Manage Presets</span>
            </Link>
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              <HomeIcon className="h-5 w-5" />
              <span>Home</span>
            </Link>
            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors duration-200"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        <div className="scrollable-content">
          <Outlet />
        </div>
      </main>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        className="relative z-50"
      >
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        {/* Full-screen container for centering */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          {/* Dialog panel */}
          <Dialog.Panel className="mx-auto max-w-sm rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
            <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
              Confirm Logout
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to log out? This will end your current session.
            </Dialog.Description>

            <div className="mt-4 flex justify-end space-x-2">
              <button
                className="px-3 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 
                         hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-2 rounded-md text-sm text-white bg-red-600 
                         hover:bg-red-700 focus:outline-none focus:ring-2 
                         focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                onClick={handleLogoutConfirm}
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