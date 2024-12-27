// src/services/api.js

import axios from 'axios';
import { getApiUrl, setAuthToken } from '../utils/auth';

const baseURL = getApiUrl();

// Debug configuration in development
if (import.meta.env.DEV) {
  console.log('API Service Configuration:', {
    baseURL,
    mode: import.meta.env.MODE,
    isDev: import.meta.env.DEV
  });
}

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    const isTokenRefreshUrl = config.url.includes('/api/token/refresh/');

    // Exclude Authorization header for token refresh requests
    if (token && !isTokenRefreshUrl) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Ensure trailing slash on URL
    if (!config.url.endsWith('/')) {
      config.url = `${config.url}/`;
    }

    // Debug logging in development
    if (import.meta.env.DEV) {
      console.log('Making request:', {
        url: `${config.baseURL}${config.url}`,
        method: config.method,
        headers: config.headers,
        data: config.data
      });
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log('Response received:', {
        status: response.status,
        data: response.data
      });
    }
    return response;
  },
  async (error) => {
    console.error('API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });

    const originalRequest = error.config;

    // Handle token refresh logic if we get 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Exclude Authorization header when refreshing token
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
        localStorage.setItem('accessToken', access);
        setAuthToken(access);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        delete api.defaults.headers.common['Authorization'];
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ---------------------------------------------------------
// Auth API endpoints
// ---------------------------------------------------------
export const authAPI = {
  login: async (credentials) => {
    const response = await api.post('/api/token/', credentials);
    const { access, refresh } = response.data;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
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
  },
};

// ---------------------------------------------------------
// Projects API endpoints
// ---------------------------------------------------------
export const projectsAPI = {
  getAll: async () => {
    try {
      const response = await api.get('/api/projects/');
      return response;
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  },

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

// ---------------------------------------------------------
// Export the base axios instance if needed
// ---------------------------------------------------------
export default api;
