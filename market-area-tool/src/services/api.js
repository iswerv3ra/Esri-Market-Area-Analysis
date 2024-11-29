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

// Auth API endpoints
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

export default api;
