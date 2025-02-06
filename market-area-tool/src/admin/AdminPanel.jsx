import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { 
  UserCircleIcon, 
  KeyIcon, 
  UserGroupIcon,
  XMarkIcon,
  CheckIcon,
  ShieldCheckIcon,
  TrashIcon,
  ChartBarIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { adminAPI } from '../services/api';

const POLL_INTERVAL = 3000000;

const AdminPanel = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userUsage, setUserUsage] = useState({});
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUsageStats, setShowUsageStats] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAllUserUsage = useCallback(async (showLoading = true) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const response = await adminAPI.getAllUserUsageStats();
      console.log('Usage stats response:', response);
      if (response?.data) {
        setUserUsage(response.data);
        setError(null);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error('Error fetching usage statistics:', err);
      setError(err.details || err.error || 'Failed to fetch usage statistics');
    } finally {
      if (showLoading) {
        setIsRefreshing(false);
        setLoadingUsage(false);
      }
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const userData = await adminAPI.getAllUsers();
      setUsers(userData);
      setError(null);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users: ' + (err.response?.data?.detail || err.message));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    if (isOpen) {
      Promise.all([
        fetchUsers(),
        fetchAllUserUsage()
      ]);
    }
  }, [isOpen, fetchUsers, fetchAllUserUsage]);

  // Polling for updates
  useEffect(() => {
    if (!isOpen) return;

    const pollInterval = setInterval(() => {
      fetchAllUserUsage(false);
    }, POLL_INTERVAL);

    return () => clearInterval(pollInterval);
  }, [isOpen, fetchAllUserUsage]);

  const getUserUsage = useCallback((username) => {
    console.log('Getting usage for username:', username, 'Full usage data:', userUsage);
    const usage = userUsage[username];
    return {
      total_enrichments: usage?.total_enrichments || 0,
      total_cost: usage?.total_cost || 0
    };
  }, [userUsage]);

  const handleUserClick = useCallback((user) => {
    setSelectedUser(user);
    setShowUsageStats(true);
  }, []);

  const handleManualRefresh = useCallback(async () => {
    await fetchAllUserUsage(true);
  }, [fetchAllUserUsage]);

  const handleDeleteUser = useCallback(async () => {
    if (!userToDelete) return;
    
    try {
      await adminAPI.deleteUser(userToDelete.id);
      await fetchUsers();
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message;
      console.error('Error deleting user:', errorMessage);
      alert('Failed to delete user: ' + errorMessage);
    }
  }, [userToDelete, fetchUsers]);

  const resetPassword = async (userId, e) => {
    e.stopPropagation();
    try {
      const password = prompt('Enter new password (minimum 8 characters):');
      if (password && password.length >= 8) {
        await adminAPI.resetPassword(userId, password);
        alert('Password reset successfully');
      } else if (password) {
        alert('Password must be at least 8 characters long');
      }
    } catch (err) {
      alert('Failed to reset password: ' + (err.response?.data?.detail || err.message));
    }
  };

  const updateUserAccess = async (userId, updates, e) => {
    e.stopPropagation();
    try {
      await adminAPI.updateUser(userId, updates);
      await fetchUsers();
    } catch (err) {
      alert('Failed to update user access: ' + (err.response?.data?.detail || err.message));
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const renderUsageCell = (user) => {
    const usage = getUserUsage(user.username);
    if (loadingUsage) {
      return (
        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-20 rounded"></div>
      );
    }
    return (
      <div className="flex items-center space-x-2">
        <span className="font-medium text-gray-900 dark:text-gray-100">
          ${usage.total_cost.toFixed(2)}
        </span>
        <span className="text-xs text-gray-500">
          ({usage.total_enrichments})
        </span>
        <ChartBarIcon 
          className="h-5 w-5 text-blue-500 hover:text-blue-600 cursor-pointer"
        />
      </div>
    );
  };

  const UsageStatsModal = () => {
    if (!selectedUser) return null;

    const usage = getUserUsage(selectedUser.username);
    console.log('Modal usage data for', selectedUser.username, ':', usage);
    
    const chartData = [
      {
        name: 'Current Usage',
        Enrichments: usage.total_enrichments,
        Cost: usage.total_cost
      }
    ];

    return (
      <Dialog 
        open={showUsageStats} 
        onClose={() => setShowUsageStats(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                Usage Statistics for {selectedUser.username}
              </Dialog.Title>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleManualRefresh}
                  className="text-gray-400 hover:text-gray-500"
                  disabled={isRefreshing}
                >
                  <ArrowPathIcon className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowUsageStats(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">Total Cost</h3>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    ${usage.total_cost.toFixed(2)}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-200">Total Enrichments</h3>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {usage.total_enrichments}
                  </p>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" orientation="left" stroke="#3B82F6" />
                    <YAxis yAxisId="right" orientation="right" stroke="#10B981" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="Cost" fill="#3B82F6" name="Cost ($)" />
                    <Bar yAxisId="right" dataKey="Enrichments" fill="#10B981" name="Enrichments" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    );
  };

  const DeleteConfirmationModal = () => (
    <Dialog 
      open={showDeleteConfirm} 
      onClose={() => setShowDeleteConfirm(false)}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
          <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Delete User
          </Dialog.Title>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Are you sure you want to delete user "{userToDelete?.username}"? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-4">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteUser}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );

  const DebugInfo = () => (
    <div className="mt-4 bg-gray-100 dark:bg-gray-800 p-4 rounded">
      <h3 className="text-sm font-medium mb-2">Debug Information</h3>
      <pre className="text-xs overflow-auto">
        {JSON.stringify({
          userUsageKeys: Object.keys(userUsage),
          sampleUser: users[0]?.username,
          sampleUsage: users[0]?.username ? userUsage[users[0].username] : null
        }, null, 2)}
      </pre>
    </div>
  );

  const renderUsersTable = () => (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex justify-between items-center">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search users..."
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
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="ml-4 text-gray-400 hover:text-gray-500 disabled:opacity-50"
          title="Refresh usage statistics"
        >
          <ArrowPathIcon className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>

      <div className="flex-1 -mx-6">
        <div className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <div className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <div className="flex min-w-full">
              <div className="w-2/6 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                User
              </div>
              <div className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </div>
              <div className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Role
              </div>
              <div className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Usage
              </div>
              <div className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto max-h-[calc(100vh-30rem)]">
            {filteredUsers.map((user) => (
              <div 
                key={user.id} 
                className="flex min-w-full hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => handleUserClick(user)}
              >
                <div className="w-2/6 px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <UserCircleIcon className="h-5 w-5 text-gray-400" />
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.username}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-1/6 px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateUserAccess(user.id, { is_active: !user.is_active }, e);
                    }}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      user.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}
                  >
                    {user.is_active ? (
                      <><CheckIcon className="h-4 w-4 mr-1" /> Active</>
                    ) : (
                      <><XMarkIcon className="h-4 w-4 mr-1" /> Inactive</>
                    )}
                  </button>
                </div>
                <div className="w-1/6 px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateUserAccess(user.id, { is_staff: !user.is_staff }, e);
                    }}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      user.is_staff
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {user.is_staff ? (
                      <><ShieldCheckIcon className="h-4 w-4 mr-1" /> Admin</>
                    ) : (
                      <><UserGroupIcon className="h-4 w-4 mr-1" /> User</>
                    )}
                  </button>
                </div>
                <div className="w-1/6 px-6 py-4 whitespace-nowrap text-sm">
                  {renderUsageCell(user)}
                </div>
                <div className="w-1/6 px-6 py-4 whitespace-nowrap">
                  <div className="flex space-x-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resetPassword(user.id, e);
                      }}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      title="Reset Password"
                    >
                      <KeyIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUserToDelete(user);
                        setShowDeleteConfirm(true);
                      }}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete User"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Dialog 
        open={isOpen} 
        onClose={onClose} 
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex h-full flex-col">
              <div className="flex-none border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center px-6 py-4">
                  <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                    Admin Panel
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {error && (
                  <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                    <span className="block sm:inline">{error}</span>
                  </div>
                )}

                {loading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  renderUsersTable()
                )}

              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      <UsageStatsModal />
      <DeleteConfirmationModal />
    </>
  );
};

export default AdminPanel;