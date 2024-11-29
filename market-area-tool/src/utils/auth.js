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
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

export const verifyToken = async (token) => {
  try {
    const baseUrl = getApiUrl();
    await axios.post(`${baseUrl}/api/token/verify/`, { token });
    
    if (isDevelopment()) {
      console.log('Token verification successful');
      console.log('Using API URL:', baseUrl);
    }
    
    return true;
  } catch (error) {
    if (isDevelopment()) {
      console.error('Token verification failed:', error);
    }
    return false;
  }
};

// Direct navigation helper
const navigateToLogin = (navigate) => {
  if (navigate) {
    navigate('/login', { replace: true });
  } else {
    window.location.href = '/login';
  }
};

// Clear tokens helper
const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  delete axios.defaults.headers.common['Authorization'];
};

// Axios interceptors setup
export const setupAxiosInterceptors = (navigate) => {
  const requestInterceptor = axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('accessToken');
      
      // Check for token existence before making request
      if (!token) {
        clearTokens();
        navigateToLogin(navigate);
        return Promise.reject(new Error('No access token'));
      }
      
      config.headers.Authorization = `Bearer ${token}`;
      
      // Ensure trailing slashes for Django
      if (!config.url.endsWith('/')) {
        config.url += '/';
      }
      
      if (isDevelopment()) {
        console.log('Request:', {
          url: config.url,
          method: config.method
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
            clearTokens();
            navigateToLogin(navigate);
            return Promise.reject(error);
          }

          const baseUrl = getApiUrl();
          const response = await axios.post(`${baseUrl}/api/token/refresh/`, {
            refresh: refreshToken
          });

          const { access } = response.data;
          localStorage.setItem('accessToken', access);
          setAuthToken(access);
          
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return axios(originalRequest);
          
        } catch (err) {
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
  return !!localStorage.getItem('accessToken');
};

export const logout = async (navigate) => {
  try {
    clearTokens();
    navigateToLogin(navigate);
  } catch (error) {
    if (isDevelopment()) {
      console.error('Logout error:', error);
    }
    // Fallback to direct navigation if error occurs
    window.location.href = '/login';
  }
};