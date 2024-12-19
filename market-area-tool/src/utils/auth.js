// src/utils/auth.js

import axios from 'axios';

// Helper to determine environment
const isDevelopment = () => {
  return import.meta.env.VITE_APP_ENV === 'development';
};

// Get API URL with proper environment handling
export const getApiUrl = () => {
  // Development environment - use local URL
  if (isDevelopment()) {
    return 'http://localhost:8000';
  }
  // Production environment - use Choreo config
  return '/choreo-apis/market-area-analysis/backend/v1';
};

// Token management
export const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    if (isDevelopment()) {
      console.log('[setAuthToken] Authorization header set with token.');
    }
  } else {
    delete axios.defaults.headers.common['Authorization'];
    if (isDevelopment()) {
      console.log('[setAuthToken] Authorization header removed.');
    }
  }
};

export const verifyToken = async (token) => {
  try {
    const baseUrl = getApiUrl();
    if (isDevelopment()) {
      console.log('[verifyToken] Verifying token at:', `${baseUrl}/api/token/verify/`);
      console.log('[verifyToken] Token:', token);
    }

    await axios.post(`${baseUrl}/api/token/verify/`, { token });

    if (isDevelopment()) {
      console.log('[verifyToken] Token verification successful');
      console.log('[verifyToken] Using API URL:', baseUrl);
    }

    return true;
  } catch (error) {
    if (isDevelopment()) {
      console.error('[verifyToken] Token verification failed:', error);
    }
    return false;
  }
};

// Direct navigation helper
const navigateToLogin = (navigate) => {
  if (isDevelopment()) {
    console.log('[navigateToLogin] Redirecting to /login...');
  }
  if (navigate) {
    navigate('/login', { replace: true });
  } else {
    window.location.href = '/login';
  }
};

// Clear tokens helper
const clearTokens = () => {
  if (isDevelopment()) {
    console.log('[clearTokens] Clearing tokens from localStorage.');
  }
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  delete axios.defaults.headers.common['Authorization'];
};

// Axios interceptors setup
export const setupAxiosInterceptors = (navigate) => {
  const requestInterceptor = axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('accessToken');
      const isTokenRefreshUrl = config.url.includes('/api/token/refresh/');

      if (isDevelopment()) {
        console.log('[requestInterceptor] Outgoing request details:', {
          url: config.url,
          method: config.method,
          headers: config.headers,
          tokenPresent: !!token,
          isTokenRefreshUrl,
        });
      }

      // Check for token existence before making request
      if (!token && !isTokenRefreshUrl) {
        if (isDevelopment()) {
          console.warn('[requestInterceptor] No access token found. Redirecting to login.');
        }
        clearTokens();
        navigateToLogin(navigate);
        return Promise.reject(new Error('No access token'));
      }

      // Exclude Authorization header for token refresh requests
      if (token && !isTokenRefreshUrl) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Ensure trailing slashes for Django
      if (!config.url.endsWith('/')) {
        config.url += '/';
      }

      if (isDevelopment()) {
        console.log('[requestInterceptor] Final request config:', {
          url: config.url,
          headers: config.headers,
        });
      }

      return config;
    },
    (error) => {
      if (isDevelopment()) {
        console.error('[requestInterceptor] Request error:', error);
      }
      return Promise.reject(error);
    }
  );

  const responseInterceptor = axios.interceptors.response.use(
    (response) => {
      if (isDevelopment()) {
        console.log('[responseInterceptor] Successful response:', {
          url: response.config.url,
          status: response.status,
          data: response.data,
        });
      }
      return response;
    },
    async (error) => {
      if (isDevelopment()) {
        console.error('[responseInterceptor] Response error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
        });
      }

      const originalRequest = error.config;

      // Handle 401 errors (unauthorized)
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        if (isDevelopment()) {
          console.warn('[responseInterceptor] Received 401. Attempting token refresh...');
        }

        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) {
            if (isDevelopment()) {
              console.warn('[responseInterceptor] No refresh token available. Redirecting to login.');
            }
            clearTokens();
            navigateToLogin(navigate);
            return Promise.reject(error);
          }

          const baseUrl = getApiUrl();
          // Exclude Authorization header when refreshing token
          const response = await axios.post(
            `${baseUrl}/api/token/refresh/`,
            { refresh: refreshToken },
            { headers: { 'Content-Type': 'application/json' } }
          );

          const { access } = response.data;
          if (isDevelopment()) {
            console.log('[responseInterceptor] Token refresh successful, new access token:', access);
          }
          localStorage.setItem('accessToken', access);
          setAuthToken(access);

          originalRequest.headers.Authorization = `Bearer ${access}`;
          return axios(originalRequest);

        } catch (err) {
          if (isDevelopment()) {
            console.error('[responseInterceptor] Token refresh failed:', err);
          }
          // Immediately clear tokens and redirect on refresh failure
          clearTokens();
          navigateToLogin(navigate);
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }
  );

  return () => {
    axios.interceptors.request.eject(requestInterceptor);
    axios.interceptors.response.eject(responseInterceptor);
  };
};

export const isAuthenticated = () => {
  const authenticated = !!localStorage.getItem('accessToken');
  if (isDevelopment()) {
    console.log('[isAuthenticated] Access token present:', authenticated);
  }
  return authenticated;
};

export const logout = async (navigate) => {
  try {
    if (isDevelopment()) {
      console.log('[logout] Logging out...');
    }
    clearTokens();
    navigateToLogin(navigate);
  } catch (error) {
    if (isDevelopment()) {
      console.error('[logout] Logout error:', error);
    }
    // Fallback to direct navigation if error occurs
    window.location.href = '/login';
  }
};
