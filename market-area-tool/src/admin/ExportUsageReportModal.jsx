import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { 
  XMarkIcon, 
  ArrowDownTrayIcon, 
  UserPlusIcon, 
  XCircleIcon,
  CheckIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { adminAPI } from '../services/api';

const ExportUsageReportModal = ({ isOpen, onClose, users }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Set default end date to today
      const today = new Date();
      const formattedToday = today.toISOString().split('T')[0];
      setEndDate(formattedToday);
      
      // Set default start date to 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      const formattedThirtyDaysAgo = thirtyDaysAgo.toISOString().split('T')[0];
      setStartDate(formattedThirtyDaysAgo);
      
      // Reset other state
      setSearchTerm('');
      setSelectedUsers([]);
      setFilteredUsers([]);
      setExportError(null);
    }
  }, [isOpen]);

  // Filter users based on search term
  useEffect(() => {
    if (searchTerm) {
      setFilteredUsers(
        users.filter(user => 
          user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredUsers([]);
    }
  }, [searchTerm, users]);

  const handleAddUser = (user) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setSearchTerm('');
  };

  const handleRemoveUser = (userId) => {
    setSelectedUsers(selectedUsers.filter(user => user.id !== userId));
  };

  const handleSelectAll = () => {
    setSelectedUsers(users);
  };

  const handleClearSelection = () => {
    setSelectedUsers([]);
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportError(null);
      
      await adminAPI.exportUserUsageStats({
        startDate,
        endDate,
        userIds: selectedUsers.length > 0 ? selectedUsers.map(user => user.id) : null
      });
      
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      setExportError('Failed to export report: ' + (error.response?.data?.detail || error.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
              Export Usage Report
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {exportError && (
            <div className="mb-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded relative">
              <span className="block sm:inline">{exportError}</span>
            </div>
          )}

          <div className="space-y-6">
            {/* Date Range Selection */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
                Date Range
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md p-2 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md p-2 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* User Selection */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  <UserPlusIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
                  User Selection
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    Select All
                  </button>
                  <span className="text-xs text-gray-400">|</span>
                  <button
                    onClick={handleClearSelection}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search users to add..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* User search results */}
              {searchTerm && filteredUsers.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto border rounded-md dark:border-gray-600">
                  {filteredUsers.map(user => (
                    <div 
                      key={user.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => handleAddUser(user)}
                    >
                      <div className="flex items-center">
                        <div className="mr-2">
                          <UserPlusIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {user.username}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <div>
                        {selectedUsers.some(u => u.id === user.id) && (
                          <CheckIcon className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected users */}
              {selectedUsers.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Selected Users ({selectedUsers.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {selectedUsers.map(user => (
                        <div 
                          key={user.id}
                          className="inline-flex items-center bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full px-3 py-1 text-sm"
                        >
                          {user.username}
                          <button 
                            onClick={() => handleRemoveUser(user.id)}
                            className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          >
                            <XCircleIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Info text */}
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              {selectedUsers.length === 0 
                ? "No users selected. Report will include data for all users." 
                : `Report will include data for ${selectedUsers.length} selected user(s).`}
            </div>

            {/* Export action */}
            <div className="flex justify-end">
              <button
                onClick={handleExport}
                disabled={isExporting || !startDate || !endDate}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                    Export Report
                  </>
                )}
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default ExportUsageReportModal;