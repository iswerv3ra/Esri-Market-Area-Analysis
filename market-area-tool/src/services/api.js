// src/api.js

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

// Create separate axios instances to prevent interceptor loops
const authAxios = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track refresh token promise to prevent multiple refresh attempts
let isRefreshing = false;
let refreshSubscribers = [];

// Helper function to add new request to subscribers
const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

// Helper function to execute all subscribers
const onRefreshed = (token) => {
  refreshSubscribers.map(callback => callback(token));
  refreshSubscribers = [];
};

// Handle token refresh
const refreshAuthToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await authAxios.post('/api/token/refresh/', {
      refresh: refreshToken
    });
    const { access } = response.data;
    localStorage.setItem('accessToken', access);
    setAuthToken(access);
    return access;
  } catch (error) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
    throw error;
  }
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    const isAuthEndpoint = [
      '/api/token/',
      '/api/token/refresh/',
      '/api/token/verify/'
    ].some(endpoint => config.url.includes(endpoint));

    if (token && !isAuthEndpoint) {
      config.headers.Authorization = `Bearer ${token}`;
    }

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
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for token refresh
        try {
          const token = await new Promise(resolve => {
            subscribeTokenRefresh(token => {
              resolve(token);
            });
          });
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        } catch (err) {
          return Promise.reject(err);
        }
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const token = await refreshAuthToken();
        onRefreshed(token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authAPI = {
  login: async (credentials) => {
    const response = await authAxios.post('/api/token/', credentials);
    const { access, refresh } = response.data;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
    setAuthToken(access);
    return response;
  },
  
  register: async (userData) => {
    return authAxios.post('/api/user/register/', userData);
  },

  refreshToken: async (refreshToken) => {
    return authAxios.post('/api/token/refresh/', { refresh: refreshToken });
  },

  verifyToken: async (token) => {
    try {
      await authAxios.post('/api/token/verify/', { token });
      return true;
    } catch (error) {
      return false;
    }
  }
};

// Projects API endpoints
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
  }
};

// Style Presets API endpoints
export const stylePresetsAPI = {
  getAll: async () => {
    try {
      const response = await api.get('/api/style-presets/');
      return response;
    } catch (error) {
      console.error('Error fetching style presets:', error);
      throw error;
    }
  },

  create: async (presetData) => {
    try {
      const response = await api.post('/api/style-presets/', presetData);
      return response;
    } catch (error) {
      console.error('Error creating style preset:', error);
      throw error;
    }
  },

  update: async (id, presetData) => {
    try {
      const response = await api.put(`/api/style-presets/${id}/`, presetData);
      return response;
    } catch (error) {
      console.error(`Error updating style preset ${id}:`, error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/api/style-presets/${id}/`);
      return response;
    } catch (error) {
      console.error(`Error deleting style preset ${id}:`, error);
      throw error;
    }
  },

  makeGlobal: async (id) => {
    try {
      const response = await api.post(`/api/style-presets/${id}/make_global/`);
      return response;
    } catch (error) {
      console.error(`Error making style preset ${id} global:`, error);
      throw error;
    }
  }
};

// Variable Presets API endpoints
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
      console.log('Variable Preset API - Creating preset with data:', presetData);
      const response = await api.post('/api/variable-presets/', presetData);
      console.log('Variable Preset API - Response:', response);
      return response;
    } catch (error) {
      console.error('Error creating variable preset:', error);
      console.error('Error response:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
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
  }
};

export default api;