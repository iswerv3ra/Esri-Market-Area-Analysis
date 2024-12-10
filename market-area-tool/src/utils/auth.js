// src/utils/auth.js

import axios from 'axios';

// Environment helper functions
const isDevelopment = () => {
  const mode = import.meta.env.MODE;
  const devMode = import.meta.env.VITE_APP_ENV === 'development';
  return mode === 'development' || devMode;
};

// Get API URL with proper environment handling
export const getApiUrl = () => {
  // Development environment - use local URL
  if (isDevelopment()) {
    const devUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    console.log('Using development API URL:', devUrl);
    return devUrl;
  }
  // Production environment - use Choreo config
  const prodUrl = import.meta.env.VITE_API_BASE_URL || '/choreo-apis/market-area-analysis/backend/v1';
  console.log('Using production API URL:', prodUrl);
  return prodUrl;
};

// Token management functions
export const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    if (isDevelopment()) {
      console.log('Auth token set');
    }
  } else {
    delete axios.defaults.headers.common['Authorization'];
    if (isDevelopment()) {
      console.log('Auth token removed');
    }
  }
};

export const getStoredToken = () => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    setAuthToken(token);
  }
  return token;
};

// Token verification
export const verifyToken = async (token) => {
  if (!token) {
    if (isDevelopment()) {
      console.log('No token provided for verification');
    }
    return false;
  }

  try {
    const baseUrl = getApiUrl();
    await axios.post(`${baseUrl}/api/token/verify/`, { token });
    
    if (isDevelopment()) {
      console.log('Token verification successful');
    }
    
    return true;
  } catch (error) {
    if (isDevelopment()) {
      console.error('Token verification failed:', error);
    }
    clearAuth();
    return false;
  }
};

// Token refresh
export const refreshToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    if (isDevelopment()) {
      console.error('No refresh token available');
    }
    throw new Error('No refresh token available');
  }

  try {
    const baseUrl = getApiUrl();
    const response = await axios.post(`${baseUrl}/api/token/refresh/`, {
      refresh: refreshToken
    });
    
    const { access } = response.data;
    localStorage.setItem('accessToken', access);
    setAuthToken(access);

    if (isDevelopment()) {
      console.log('Token refresh successful');
    }

    return access;
  } catch (error) {
    if (isDevelopment()) {
      console.error('Token refresh failed:', error);
    }
    clearAuth();
    throw error;
  }
};

// Auth state cleanup
export const clearAuth = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  setAuthToken(null);
  if (isDevelopment()) {
    console.log('Auth state cleared');
  }
};

// Auth state check
export const isAuthenticated = () => {
  const hasToken = !!localStorage.getItem('accessToken');
  if (isDevelopment()) {
    console.log('Auth state check:', hasToken ? 'authenticated' : 'not authenticated');
  }
  return hasToken;
};

// Navigation helpers
const navigateToLogin = (navigate) => {
  if (navigate) {
    navigate('/login', { replace: true });
  } else {
    window.location.href = '/login';
  }
};

// Axios interceptors setup
export const setupAxiosInterceptors = (navigate) => {
  // Request interceptor
  const requestInterceptor = axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('accessToken');
      const isAuthEndpoint = [
        '/api/token/',
        '/api/token/refresh/',
        '/api/token/verify/'
      ].some(endpoint => config.url.includes(endpoint));

      if (!token && !isAuthEndpoint) {
        clearAuth();
        navigateToLogin(navigate);
        return Promise.reject(new Error('No access token'));
      }

      if (token && !isAuthEndpoint) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Ensure trailing slash for Django
      if (!config.url.endsWith('/')) {
        config.url += '/';
      }

      if (isDevelopment()) {
        console.log('Request:', {
          url: config.url,
          method: config.method,
          headers: config.headers,
        });
      }

      return config;
    },
    (error) => {
      if (isDevelopment()) {
        console.error('Request interceptor error:', error);
      }
      return Promise.reject(error);
    }
  );

  // Response interceptor
  const responseInterceptor = axios.interceptors.response.use(
    (response) => {
      if (isDevelopment()) {
        console.log('Response received:', {
          status: response.status,
          url: response.config.url
        });
      }
      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        if (isDevelopment()) {
          console.log('Attempting token refresh...');
        }

        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          const newToken = await refreshToken();
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          
          if (isDevelopment()) {
            console.log('Token refresh successful, retrying request');
          }

          return axios(originalRequest);
        } catch (refreshError) {
          if (isDevelopment()) {
            console.error('Token refresh failed:', refreshError);
          }
          clearAuth();
          navigateToLogin(navigate);
          return Promise.reject(refreshError);
        }
      }

      if (isDevelopment()) {
        console.error('Response error:', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
      }

      return Promise.reject(error);
    }
  );

  // Return cleanup function
  return () => {
    axios.interceptors.request.eject(requestInterceptor);
    axios.interceptors.response.eject(responseInterceptor);
  };
};

// Logout function
export const logout = async (navigate) => {
  try {
    clearAuth();
    navigateToLogin(navigate);
  } catch (error) {
    if (isDevelopment()) {
      console.error('Logout error:', error);
    }
    // Fallback to direct navigation
    window.location.href = '/login';
  }
};