import axios from 'axios';

// Helper to determine environment
const isDevelopment = () => {
  return import.meta.env.MODE === 'development' || import.meta.env.DEV;
};

// Get API URL with proper environment handling
export const getApiUrl = () => {
  // Development environment - use local URL
  if (isDevelopment()) {
    return 'http://localhost:8000';
  }

  // Production environment - prefer Choreo config, fallback to env
  return window.configs?.apiUrl || '/choreo-apis/market-area-analysis/backend/v1';
};

// Get base URL for API calls
export const getBaseUrl = () => `${getApiUrl()}/api`;

// Token management
export const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

export const verifyToken = async (token) => {
  try {
    const baseUrl = getBaseUrl();
    if (isDevelopment()) {
      // Local development - send token in request body
      await axios.post(`${baseUrl}/token/verify/`, { token });
    } else {
      // Production - send token in Authorization header
      await axios.post(`${baseUrl}/token/verify/`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
    return true;
  } catch (error) {
    if (isDevelopment()) {
      console.error('Token verification failed:', error);
      console.log('Request details:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data
      });
    }
    return false;
  }
};

// Axios interceptors setup
export const setupAxiosInterceptors = (navigate) => {
  const requestInterceptor = axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Ensure trailing slashes for Django
      if (!config.url.endsWith('/')) {
        config.url += '/';
      }
      
      // Debug logging in development
      if (isDevelopment()) {
        console.log('Request:', {
          url: config.url,
          method: config.method,
          headers: config.headers
        });
      }
      
      return config;
    },
    (error) => Promise.reject(error)
  );

  const responseInterceptor = axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Handle 401 errors (unauthorized)
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          const baseUrl = getBaseUrl();
          const response = await axios.post(`${baseUrl}/token/refresh/`, {
            refresh: refreshToken
          });

          const { access } = response.data;
          localStorage.setItem('accessToken', access);
          setAuthToken(access);

          // Update the failed request with new token
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return axios(originalRequest);
        } catch (err) {
          if (isDevelopment()) {
            console.error('Token refresh failed:', err);
          }
          await logout(navigate);
          return Promise.reject(err);
        }
      }

      // Handle 405 errors (method not allowed)
      if (error.response?.status === 405) {
        if (isDevelopment()) {
          console.error('Method not allowed:', {
            url: error.config?.url,
            method: error.config?.method
          });
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
  return !!localStorage.getItem('accessToken');
};

export const logout = async (navigate) => {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    delete axios.defaults.headers.common['Authorization'];
    
    if (navigate) {
      navigate('/login', { replace: true });
    } else {
      window.location.href = '/login';
    }
  } catch (error) {
    if (isDevelopment()) {
      console.error('Logout error:', error);
    }
    window.location.href = '/login';
  }
};