import api from './api';

export const userManagementAPI = {
  getCurrentUser: async () => {
    try {
      const response = await api.get('/api/admin/users/me/');
      return response.data;
    } catch (error) {
      console.error('Error fetching current user:', error);
      throw error;
    }
  },

  getAllUsers: async () => {
    try {
      const response = await api.get('/api/admin/users/');
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  updateUser: async (userId, userData) => {
    try {
      const response = await api.patch(`/api/admin/users/${userId}/`, userData);
      return response.data;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  resetPassword: async (userId, newPassword) => {
    try {
      const response = await api.post(`/api/admin/users/${userId}/password/`, {
        password: newPassword
      });
      return response.data;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  },

  deleteUser: async (userId) => {
    try {
      const response = await api.delete(`/api/admin/users/${userId}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  getAllUserUsageStats: async () => {
    try {
      const response = await api.get('/api/admin/users/usage_stats_all/');
      console.log('Raw Usage Stats Response:', response);
      
      // Transform the response to use usernames as keys
      const usersResponse = await api.get('/api/admin/users/');
      const users = usersResponse.data;
      
      // Create a mapping of ID to username
      const idToUsername = {};
      users.forEach(user => {
        idToUsername[user.id] = user.username;
      });
      
      // Transform the data to use usernames as keys
      const transformedData = {};
      Object.entries(response.data).forEach(([userId, stats]) => {
        const username = idToUsername[userId];
        if (username) {
          transformedData[username] = stats;
        }
      });
      
      console.log('Transformed Usage Stats:', transformedData);
      return { data: transformedData };
    } catch (error) {
      console.error('Error fetching all users usage statistics:', error);
      throw error;
    }
  },

  // Get usage stats for individual user
  getUserUsageStats: async (userId) => {
    try {
      const response = await api.get(`/api/admin/users/${userId}/usage_stats/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user usage stats:', error);
      throw error;
    }
  }
};

export default userManagementAPI;