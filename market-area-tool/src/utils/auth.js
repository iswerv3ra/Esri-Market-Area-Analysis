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
    const response = await axios.post(`${baseUrl}/api/token/verify/`, { token });
    
    if (isDevelopment()) {
      console.group('Token Verification');
      console.log('Token verification successful');
      console.log('Using API URL:', baseUrl);
      console.log('Verification Response:', response.data);
      console.groupEnd();
    }
    
    return true;
  } catch (error) {
    if (isDevelopment()) {
      console.group('Token Verification Failure');
      console.error('Token verification failed:', error.response || error);
      console.groupEnd();
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
  console.group('Token Clearance');
  console.log('Clearing tokens and authentication');
  
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  delete axios.defaults.headers.common['Authorization'];
  
  console.log('Tokens removed from localStorage and axios defaults');
  console.groupEnd();
};

export const setupAxiosInterceptors = (navigate) => {
  const requestInterceptor = axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('accessToken');
      const isTokenRefreshUrl = config.url.includes('/api/token/refresh/');
      const isTokenVerifyUrl = config.url.includes('/api/token/verify/');
      
      console.group('Axios Request Interceptor');
      console.log('Request URL:', config.url);
      console.log('Access Token Exists:', !!token);
      console.log('Is Token Refresh URL:', isTokenRefreshUrl);
      console.log('Is Token Verify URL:', isTokenVerifyUrl);
      
      // Check for token existence before making request
      if (!token && !isTokenRefreshUrl && !isTokenVerifyUrl) {
        console.log('No access token found, redirecting to login');
        clearTokens();
        navigateToLogin(navigate);
        console.groupEnd();
        return Promise.reject(new Error('No access token'));
      }
      
      // Attach Authorization header for non-refresh requests
      if (token && !isTokenRefreshUrl && !isTokenVerifyUrl) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Ensure trailing slashes for Django
      if (!config.url.endsWith('/')) {
        config.url = `${config.url}/`;
      }
      
      console.log('Final Request Config:', {
        url: config.url,
        method: config.method,
        headers: config.headers,
      });
      console.groupEnd();
      
      return config;
    },
    (error) => {
      console.error('Request Interceptor Error:', error);
      return Promise.reject(error);
    }
  );

  const responseInterceptor = axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      console.group('Axios Response Interceptor');
      console.log('Error Details:', {
        status: error.response?.status,
        url: originalRequest?.url,
        method: originalRequest?.method
      });

      // Handle 401 errors (unauthorized)
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = localStorage.getItem('refreshToken');
          
          if (!refreshToken) {
            console.log('No refresh token available, redirecting to login');
            clearTokens();
            navigateToLogin(navigate);
            console.groupEnd();
            return Promise.reject(error);
          }

          console.log('Attempting token refresh');
          const baseUrl = getApiUrl();
          const response = await axios.post(
            `${baseUrl}/api/token/refresh/`,
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
          console.groupEnd();
          return axios(originalRequest);
          
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          clearTokens();
          navigateToLogin(navigate);
          console.groupEnd();
          return Promise.reject(error);
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

  return () => {
    axios.interceptors.request.eject(requestInterceptor);
    axios.interceptors.response.eject(responseInterceptor);
  };
};

export const isAuthenticated = () => {
  const token = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  
  // More robust authentication check
  const isTokenValid = !!token && !!refreshToken;
  
  if (isDevelopment()) {
    console.group('Authentication Check');
    console.log('Access Token Exists:', !!token);
    console.log('Refresh Token Exists:', !!refreshToken);
    console.log('Is Authenticated:', isTokenValid);
    console.groupEnd();
  }
  
  return isTokenValid;
};

export const logout = async (navigate) => {
  try {
    console.group('Logout Process');
    console.log('Initiating logout');
    
    clearTokens();
    navigateToLogin(navigate);
    
    console.log('Logout completed successfully');
    console.groupEnd();
  } catch (error) {
    console.error('Logout error:', error);
    window.location.href = '/login';
  }
};