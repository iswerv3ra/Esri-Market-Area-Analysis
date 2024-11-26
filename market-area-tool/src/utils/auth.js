import axios from 'axios';

// Get API URL from window.configs (Choreo) or environment variable
export const getApiUrl = () => {
  if (window.configs?.apiUrl) {
    return window.configs.apiUrl;
  }
  return import.meta.env.VITE_API_URL || '/choreo-apis/market-area-analysis/backend/v1';
};

// Get base URL for API calls
export const getBaseUrl = () => `${getApiUrl()}/api`;

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
    await axios.post(`${baseUrl}/token/verify/`, { token });
    return true;
  } catch (error) {
    console.error('Token verification failed:', error);
    return false;
  }
};

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
      
      return config;
    },
    (error) => Promise.reject(error)
  );

  const responseInterceptor = axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

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

          // Update the original request with new token
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return axios(originalRequest);
        } catch (err) {
          console.error('Token refresh failed:', err);
          await logout(navigate);
          return Promise.reject(err);
        }
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

export const isAuthenticated = () => {
  return !!localStorage.getItem('accessToken');
};

export const logout = async (navigate) => {
  try {
    // Clear all auth tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    
    // Clear axios default header
    delete axios.defaults.headers.common['Authorization'];
    
    // Force navigation to login
    if (navigate) {
      navigate('/login', { replace: true });
    } else {
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Logout error:', error);
    // Force redirect even if there's an error
    window.location.href = '/login';
  }
};