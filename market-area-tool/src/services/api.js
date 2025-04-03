import axios from 'axios';
import { getApiUrl, setAuthToken } from '../utils/auth';

const baseURL = getApiUrl();

// Debug configuration in development
if (import.meta.env.DEV) {
  console.group('API Service Initialization');
  console.log('API Service Configuration:', {
    baseURL,
    mode: import.meta.env.MODE,
    isDev: import.meta.env.DEV
  });
  console.groupEnd();
}

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 100000, // 10-second timeout
});

// Enhanced Request Interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const isTokenRefreshUrl = config.url.includes('/api/token/refresh/');
    const isTokenVerifyUrl = config.url.includes('/api/token/verify/');

    // Comprehensive logging for request
    if (import.meta.env.DEV) {
      console.group('API Request');
      console.log('Request URL:', `${config.baseURL}${config.url}`);
      console.log('Method:', config.method);
      console.log('Access Token Exists:', !!token);
      console.log('Is Token Refresh URL:', isTokenRefreshUrl);
      console.log('Is Token Verify URL:', isTokenVerifyUrl);
      console.groupEnd();
    }

    // Attach Authorization header for non-refresh requests
    if (token && !isTokenRefreshUrl && !isTokenVerifyUrl) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Ensure trailing slash on URL
    if (!config.url.endsWith('/')) {
      config.url = `${config.url}/`;
    }

    return config;
  },
  (error) => {
    console.error('Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

// Enhanced Response Interceptor
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.group('API Response');
      console.log('Status:', response.status);
      console.log('Data:', response.data);
      console.groupEnd();
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    console.group('API Error Handling');
    console.log('Error Details:', {
      status: error.response?.status,
      url: originalRequest?.url,
      method: originalRequest?.method
    });

    // Token refresh logic for 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!refreshToken) {
          console.log('No refresh token available, redirecting to login');
          localStorage.clear();
          window.location.href = '/login';
          return Promise.reject(error);
        }

        console.log('Attempting token refresh');
        const response = await axios.post(
          `${baseURL}/api/token/refresh/`,
          { refresh: refreshToken },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const { access } = response.data;
        
        console.log('Token refresh successful');
        localStorage.setItem('accessToken', access);
        setAuthToken(access);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle other error scenarios
    if (error.response) {
      switch (error.response.status) {
        case 403:
          console.log('Forbidden: Insufficient permissions');
          break;
        case 404:
          console.log('Resource Not Found:', originalRequest?.url);
          break;
        case 500:
          console.log('Internal Server Error');
          break;
      }
    }

    console.groupEnd();
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------
// Auth API endpoints
// ---------------------------------------------------------
export const authAPI = {
  login: async (credentials) => {
    const response = await api.post('/api/token/', credentials);
    const { access, refresh, user_id } = response.data; // Add user_id to destructuring
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
    localStorage.setItem('userId', user_id); // Store user ID
    setAuthToken(access);
    return response;
  },
  
  register: async (userData) => {
    return api.post('/api/user/register/', userData);
  },

  refreshToken: async (refreshToken) => {
    return axios.post(
      `${baseURL}/api/token/refresh/`,
      { refresh: refreshToken },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  },

  verifyToken: async (token) => {
    try {
      await api.post('/api/token/verify/', { token });
      return true;
    } catch (error) {
      return false;
    }
  }
};

// ---------------------------------------------------------
// Projects API endpoints
// ---------------------------------------------------------
export const projectsAPI = {
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/api/projects/', {
        params: {
          page: params.page || 1,
          page_size: params.page_size || 20,
          search: params.search || '',
          ordering: params.ordering || '-last_modified'
        }
      });
      return response;
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  },

  retrieve: async (id) => {
    try {
      const response = await api.get(`/api/projects/${id}/`);
      return response;
    } catch (error) {
      console.error(`Error fetching project ${id}:`, error);
      throw error;
    }
  },

  // Rest of the methods remain the same
  create: async (projectData) => {
    try {
      const response = await api.post('/api/projects/', projectData);
      return response;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/api/projects/${id}/`);
      return response;
    } catch (error) {
      console.error(`Error fetching project ${id}:`, error);
      throw error;
    }
  },

  update: async (id, projectData) => {
    try {
      const response = await api.put(`/api/projects/${id}/`, projectData);
      return response;
    } catch (error) {
      console.error(`Error updating project ${id}:`, error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/api/projects/${id}/`);
      return response;
    } catch (error) {
      console.error(`Error deleting project ${id}:`, error);
      throw error;
    }
  },
};

// ---------------------------------------------------------
// TCG Themes API endpoints
// ---------------------------------------------------------
export const tcgThemesAPI = {
  getAll: async () => {
    try {
      // Fetch all TCG Themes from the backend
      const response = await api.get('/api/tcg-themes/');
      return response; // or response.data
    } catch (error) {
      console.error('Error fetching TCG Themes:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      // Correctly fetch a single TCG Theme by ID without colon
      const response = await api.get(`/api/tcg-themes/${id}/`);
      return response;
    } catch (error) {
      console.error(`Error fetching TCG Theme ${id}:`, error);
      throw error;
    }
  },

  create: async (themeData) => {
    try {
      // Create a new TCG Theme
      const response = await api.post('/api/tcg-themes/', themeData);
      return response;
    } catch (error) {
      console.error('Error creating TCG Theme:', error);
      throw error;
    }
  },

  update: async (id, themeData) => {
    try {
      // Update a TCG Theme by ID without colon
      const response = await api.put(`/api/tcg-themes/${id}/`, themeData);
      return response;
    } catch (error) {
      console.error(`Error updating TCG Theme ${id}:`, error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      // Delete a TCG Theme by ID without colon
      const response = await api.delete(`/api/tcg-themes/${id}/`);
      return response;
    } catch (error) {
      console.error(`Error deleting TCG Theme ${id}:`, error);
      throw error;
    }
  },

  // If you have an endpoint for making a TCG Theme global, ensure it's correctly defined
  makeGlobal: async (id) => {
    try {
      const response = await api.post(`/api/tcg-themes/${id}/make_global/`);
      return response;
    } catch (error) {
      console.error(`Error making TCG Theme ${id} global:`, error);
      throw error;
    }
  },
};

// ---------------------------------------------------------
// Color Keys API endpoints
// ---------------------------------------------------------
export const colorKeysAPI = {
  getAll: async () => {
    try {
      const response = await api.get('/api/color-keys/');
      return response;
    } catch (error) {
      console.error('Error fetching Color Keys:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      // Correctly fetch a single Color Key by ID without colon
      const response = await api.get(`/api/color-keys/${id}/`);
      return response;
    } catch (error) {
      console.error(`Error fetching Color Key ${id}:`, error);
      throw error;
    }
  },

  create: async (colorKeyData) => {
    try {
      const response = await api.post('/api/color-keys/', colorKeyData);
      return response;
    } catch (error) {
      console.error('Error creating Color Key:', error);
      throw error;
    }
  },

  update: async (id, colorKeyData) => {
    try {
      const response = await api.put(`/api/color-keys/${id}/`, colorKeyData);
      return response;
    } catch (error) {
      console.error(`Error updating Color Key ${id}:`, error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/api/color-keys/${id}/`);
      return response;
    } catch (error) {
      console.error(`Error deleting Color Key ${id}:`, error);
      throw error;
    }
  },

  // If you have an endpoint for making a Color Key global, ensure it's correctly defined
  makeGlobal: async (id) => {
    try {
      const response = await api.post(`/api/color-keys/${id}/make_global/`);
      return response;
    } catch (error) {
      console.error(`Error making Color Key ${id} global:`, error);
      throw error;
    }
  },
};

// ---------------------------------------------------------
// Variable Presets API endpoints
// ---------------------------------------------------------
export const variablePresetsAPI = {
  getAll: async () => {
    try {
      const response = await api.get('/api/variable-presets/');
      return response;
    } catch (error) {
      console.error('Error fetching variable presets:', error);
      throw error;
    }
  },

  create: async (presetData) => {
    try {
      const response = await api.post('/api/variable-presets/', presetData);
      return response;
    } catch (error) {
      console.error('Error creating variable preset:', error);
      throw error;
    }
  },

  update: async (id, presetData) => {
    try {
      const response = await api.put(`/api/variable-presets/${id}/`, presetData);
      return response;
    } catch (error) {
      console.error(`Error updating variable preset ${id}:`, error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/api/variable-presets/${id}/`);
      return response;
    } catch (error) {
      console.error(`Error deleting variable preset ${id}:`, error);
      throw error;
    }
  },

  makeGlobal: async (id) => {
    try {
      const response = await api.post(`/api/variable-presets/${id}/make_global/`);
      return response;
    } catch (error) {
      console.error(`Error making variable preset ${id} global:`, error);
      throw error;
    }
  },
};

// ---------------------------------------------------------
// Market Areas API endpoints
// ---------------------------------------------------------
export const marketAreasAPI = {
  getAll: async (projectId) => {
    try {
      const response = await api.get(`/api/projects/${projectId}/market-areas/`);
      return response;
    } catch (error) {
      console.error('Error fetching Market Areas:', error);
      throw error;
    }
  },

  create: async (projectId, marketAreaData) => {
    try {
      const response = await api.post(`/api/projects/${projectId}/market-areas/`, marketAreaData);
      return response;
    } catch (error) {
      console.error('Error creating Market Area:', error);
      throw error;
    }
  },

  update: async (projectId, marketAreaId, marketAreaData) => {
    try {
      const response = await api.put(`/api/projects/${projectId}/market-areas/${marketAreaId}/`, marketAreaData);
      return response;
    } catch (error) {
      console.error(`Error updating Market Area ${marketAreaId}:`, error);
      throw error;
    }
  },

  delete: async (projectId, marketAreaId) => {
    try {
      const response = await api.delete(`/api/projects/${projectId}/market-areas/${marketAreaId}/`);
      return response;
    } catch (error) {
      console.error(`Error deleting Market Area ${marketAreaId}:`, error);
      throw error;
    }
  },

  reorder: async (projectId, newOrderData) => {
    try {
      const response = await api.post(`/api/projects/${projectId}/market-areas/reorder/`, newOrderData);
      return response;
    } catch (error) {
      console.error('Error reordering Market Areas:', error);
      throw error;
    }
  },
};

// ---------------------------------------------------------
// **Named Exports for Update Functions**
// ---------------------------------------------------------
// These exports allow you to import them directly in your components.
export const updateColorKey = async (id, updatedData) => {
  return await colorKeysAPI.update(id, updatedData);
};

export const updateTcgTheme = async (id, updatedData) => {
  return await tcgThemesAPI.update(id, updatedData);
};

export const updateMarketArea = async (projectId, marketAreaId, updatedData) => {
  return await marketAreasAPI.update(projectId, marketAreaId, updatedData);
};

export const mapConfigurationsAPI = {
  getAll: async (projectId) => {
    try {
      if (!projectId) {
        // Add a more specific error/warning if projectId is missing
        console.error('[API] mapConfigurationsAPI.getAll called without projectId!');
        throw new Error('Project ID is required to fetch map configurations');
      }

      console.log(`[API] Fetching map configurations for project: ${projectId}`); // Log the ID being sent

      const response = await api.get('/api/map-configurations/', {
        // Ensure the parameter name matches what the backend expects ('project')
        params: { project: projectId }
      });

      console.log(`[API] Received map configurations response status: ${response.status}`, response.data); // Log response

      return response; // Return the full response object
    } catch (error) {
      console.error(`[API] Error fetching map configurations for project ${projectId}:`, error.response?.data || error.message || error);
      // Don't re-throw immediately, let the calling function handle it, but log it here.
      // Consider returning a default structure or null if needed by the caller on error.
       return { data: [] }; // Return an empty array structure on error to prevent crashes upstream
      // throw error; // Or re-throw if the caller expects to catch it
    }
  },
}

// ---------------------------------------------------------
// Admin API endpoints
// ---------------------------------------------------------
export const adminAPI = {
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

// Add this to the adminAPI object in your api.js file

  exportUserUsageStats: async (params) => {
    try {
      const { startDate, endDate, userIds } = params;
      
      // Create query parameters
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('start_date', startDate);
      if (endDate) queryParams.append('end_date', endDate);
      if (userIds && userIds.length > 0) {
        userIds.forEach(id => queryParams.append('user_id', id));
      }
      
      console.log('Exporting user stats with params:', {
        startDate,
        endDate,
        userCount: userIds?.length || 'all'
      });
      
      // Make the API call with proper headers for download
      const response = await api.get(
        `/api/admin/users/export_usage_stats/?${queryParams.toString()}`,
        {
          responseType: 'blob', // Important for file downloads
          // Remove the Accept header to let the server determine content type
          // The server will set the proper Content-Type in the response
        }
      );
      
      // Create a download link and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Get the filename from the Content-Disposition header if available
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'user_usage_report.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }
      
      // Set a default filename with date range if not provided by server
      if (!contentDisposition) {
        const dateRange = startDate && endDate 
          ? `_${startDate}_to_${endDate}` 
          : '';
        filename = `user_usage_report${dateRange}.csv`;
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      link.remove();
      
      return true;
    } catch (error) {
      console.error('Error exporting user usage statistics:', error);
      
      // Check if the error response is a blob and extract the error message
      if (error.response && error.response.data instanceof Blob && 
          error.response.data.type.includes('application/json')) {
        const reader = new FileReader();
        reader.onload = function() {
          try {
            const errorJson = JSON.parse(reader.result);
            console.error('Server error details:', errorJson);
          } catch (e) {
            console.error('Failed to parse error response:', e);
          }
        };
        reader.readAsText(error.response.data);
      }
      
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
      console.log('Attempting password reset with:', {
        userId,
        hasPassword: !!newPassword
      });

      const response = await api.post(`/api/admin/users/${userId}/reset-password/`, {
        new_password: newPassword
      });
      
      console.log('Password reset response:', response);
      return response.data;
    } catch (error) {
      console.error('Password reset failed:', {
        userId,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        error: error.message
      });
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

  getUsageStats: async () => {
    try {
      const response = await api.get('/api/admin/users/usage_stats/');
      return response.data;
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      throw error;
    }
  }
};

export default api;