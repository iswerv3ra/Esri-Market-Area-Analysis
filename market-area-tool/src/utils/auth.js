import axios from 'axios';

// Configurable retry settings
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 500,
  backoffFactor: 2,
  jitter: 0.1
};

// Token storage keys
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const TOKEN_EXPIRY_KEY = 'tokenExpiry';

// Default token expiry time (in seconds) - Changed from 1 hour to 4 hours
const DEFAULT_TOKEN_EXPIRY = 14400; // 4 hours = 4 * 60 * 60 = 14400 seconds

// Helper to determine environment
const isDevelopment = () => {
  return import.meta.env.VITE_APP_ENV === 'development';
};

// Get API URL with proper environment handling
export const getApiUrl = () => {
  if (isDevelopment()) {
    return 'http://localhost:8000';
  }
  return '/choreo-apis/market-area-analysis/backend/v1';
};

// Enhanced token management
export const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // Store token in sessionStorage as well to prevent issues with localStorage
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    delete axios.defaults.headers.common['Authorization'];
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  }
};

// Save tokens with expiry - Updated default from 3600 to DEFAULT_TOKEN_EXPIRY (14400)
export const saveTokens = (accessToken, refreshToken, expiresIn = DEFAULT_TOKEN_EXPIRY) => {
  try {
    const expiryTime = Date.now() + (expiresIn * 1000);
    
    // Use both localStorage and sessionStorage for redundancy
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    
    setAuthToken(accessToken);
    
    if (isDevelopment()) {
      console.group('Token Storage');
      console.log('Tokens saved successfully');
      console.log('Access token expiry:', new Date(expiryTime).toLocaleString());
      console.groupEnd();
    }
    
    return true;
  } catch (error) {
    console.error('Error saving tokens:', error);
    return false;
  }
};

// Get tokens with fallback mechanism
export const getTokens = () => {
  try {
    // Try localStorage first
    let accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    let refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    let tokenExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    
    // If not in localStorage, try sessionStorage
    if (!accessToken || !refreshToken) {
      accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
      refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
      tokenExpiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
    }
    
    return {
      accessToken,
      refreshToken,
      tokenExpiry: tokenExpiry ? parseInt(tokenExpiry) : null
    };
  } catch (error) {
    console.error('Error retrieving tokens:', error);
    return { accessToken: null, refreshToken: null, tokenExpiry: null };
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

// Improved token clearing
const clearTokens = () => {
  console.group('Token Clearance');
  console.log('Clearing tokens and authentication');
  
  // Clear from both storage mechanisms
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  
  delete axios.defaults.headers.common['Authorization'];
  
  console.log('Tokens removed from storage and axios defaults');
  console.groupEnd();
};

// Enhanced token refresh with exponential backoff and retry
const refreshTokenWithRetry = async (refreshToken, baseUrl, navigate) => {
  const retryOperation = async (retriesLeft, delay) => {
    try {
      if (isDevelopment()) {
        console.group('Token Refresh Attempt');
        console.log(`Retries left: ${retriesLeft}, Current delay: ${delay}ms`);
      }

      const response = await axios.post(
        `${baseUrl}/api/token/refresh/`,
        { refresh: refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          // Don't use Authorization header for refresh requests
          transformRequest: [(data, headers) => {
            delete headers.Authorization;
            return JSON.stringify(data);
          }],
          timeout: 5000
        }
      );

      if (isDevelopment()) {
        console.log('Token refresh successful');
        console.groupEnd();
      }

      // Save the new access token with the existing refresh token
      if (response.data && response.data.access) {
        // Use the server-provided expiry or fall back to the default 4-hour expiry
        const expiresIn = response.data.expires_in || DEFAULT_TOKEN_EXPIRY;
        saveTokens(response.data.access, refreshToken, expiresIn);
      }

      return response.data.access;
    } catch (error) {
      console.error('Token refresh attempt failed', error);

      if (retriesLeft > 0) {
        // Calculate next delay with jitter
        const jitteredDelay = delay * (1 + (Math.random() * RETRY_CONFIG.jitter));
        
        if (isDevelopment()) {
          console.log(`Waiting ${jitteredDelay}ms before next retry`);
        }
        
        // Wait before next retry
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));

        // Recursive retry with exponential backoff
        return retryOperation(
          retriesLeft - 1, 
          delay * RETRY_CONFIG.backoffFactor
        );
      }

      if (isDevelopment()) {
        console.groupEnd();
      }
      
      // If all retries fail, clear tokens and navigate to login
      clearTokens();
      navigateToLogin(navigate);
      throw error;
    }
  };

  return retryOperation(
    RETRY_CONFIG.maxRetries, 
    RETRY_CONFIG.initialDelay
  );
};

// Check if token is expired or about to expire (within 5 minutes)
const isTokenExpired = () => {
  const { tokenExpiry } = getTokens();
  if (!tokenExpiry) return true;
  
  // Check if token is expired or will expire in the next 5 minutes
  return Date.now() > (tokenExpiry - (5 * 60 * 1000));
};

export const setupAxiosInterceptors = (navigate) => {
  // Fix potential interceptor duplication by ejecting existing interceptors
  // before setting up new ones
  if (axios.interceptors.request.handlers.length > 0) {
    axios.interceptors.request.clear();
  }
  
  if (axios.interceptors.response.handlers.length > 0) {
    axios.interceptors.response.clear();
  }

  const requestInterceptor = axios.interceptors.request.use(
    async (config) => {
      // Skip auth for token endpoints to prevent loops
      const isAuthEndpoint = config.url.includes('/api/token/') ||
                            config.url.includes('/api/login/') ||
                            config.url.includes('/api/register/');
      
      if (isDevelopment()) {
        console.group('Axios Request Interceptor');
        console.log('Request URL:', config.url);
        console.log('Is Auth Endpoint:', isAuthEndpoint);
      }
      
      // Skip token check for auth endpoints
      if (isAuthEndpoint) {
        if (isDevelopment()) {
          console.log('Auth endpoint - skipping token checks');
          console.groupEnd();
        }
        
        // Ensure trailing slashes for Django
        if (!config.url.endsWith('/')) {
          config.url = `${config.url}/`;
        }
        
        return config;
      }
      
      // Get current tokens
      const { accessToken, refreshToken } = getTokens();
      
      if (isDevelopment()) {
        console.log('Access Token Exists:', !!accessToken);
        console.log('Refresh Token Exists:', !!refreshToken);
      }
      
      // Check for token existence before making request
      if (!accessToken) {
        if (refreshToken) {
          try {
            if (isDevelopment()) {
              console.log('No access token but refresh token exists, attempting refresh');
            }
            
            // Try to refresh the token
            const baseUrl = getApiUrl();
            const newAccessToken = await refreshTokenWithRetry(refreshToken, baseUrl, navigate);
            
            // Set the new token in the request
            config.headers.Authorization = `Bearer ${newAccessToken}`;
          } catch (error) {
            if (isDevelopment()) {
              console.log('Token refresh failed during request, redirecting to login');
              console.groupEnd();
            }
            
            clearTokens();
            navigateToLogin(navigate);
            return Promise.reject(new Error('Authentication failed'));
          }
        } else {
          if (isDevelopment()) {
            console.log('No tokens available, redirecting to login');
            console.groupEnd();
          }
          
          clearTokens();
          navigateToLogin(navigate);
          return Promise.reject(new Error('No authentication tokens'));
        }
      } else if (isTokenExpired()) {
        // Token exists but is expired or about to expire
        if (refreshToken) {
          try {
            if (isDevelopment()) {
              console.log('Access token expired, attempting refresh');
            }
            
            // Try to refresh the token
            const baseUrl = getApiUrl();
            const newAccessToken = await refreshTokenWithRetry(refreshToken, baseUrl, navigate);
            
            // Set the new token in the request
            config.headers.Authorization = `Bearer ${newAccessToken}`;
          } catch (error) {
            if (isDevelopment()) {
              console.log('Token refresh failed during expiry check, redirecting to login');
              console.groupEnd();
            }
            
            clearTokens();
            navigateToLogin(navigate);
            return Promise.reject(new Error('Token refresh failed'));
          }
        } else {
          if (isDevelopment()) {
            console.log('Token expired and no refresh token, redirecting to login');
            console.groupEnd();
          }
          
          clearTokens();
          navigateToLogin(navigate);
          return Promise.reject(new Error('Authentication expired'));
        }
      } else {
        // Valid token, use it
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      // Ensure trailing slashes for Django
      if (!config.url.endsWith('/')) {
        config.url = `${config.url}/`;
      }
      
      if (isDevelopment()) {
        console.log('Final Request Config:', {
          url: config.url,
          method: config.method,
          headers: {...config.headers},
        });
        console.groupEnd();
      }
      
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
      
      // Prevent undefined access if config is not available
      if (!originalRequest) {
        console.error('Response error without request config:', error);
        return Promise.reject(error);
      }

      if (isDevelopment()) {
        console.group('Axios Response Interceptor');
        console.log('Error Details:', {
          status: error.response?.status,
          url: originalRequest?.url,
          method: originalRequest?.method
        });
      }

      // Skip retry for auth endpoints to prevent loops
      const isAuthEndpoint = originalRequest.url.includes('/api/token/') ||
                            originalRequest.url.includes('/api/login/') ||
                            originalRequest.url.includes('/api/register/');
                            
      if (isAuthEndpoint) {
        if (isDevelopment()) {
          console.log('Auth endpoint - skipping retry');
          console.groupEnd();
        }
        return Promise.reject(error);
      }

      // Handle 401 errors (unauthorized) - but only retry once
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const { refreshToken } = getTokens();
          
          if (!refreshToken) {
            if (isDevelopment()) {
              console.log('No refresh token available, redirecting to login');
              console.groupEnd();
            }
            
            clearTokens();
            navigateToLogin(navigate);
            return Promise.reject(error);
          }

          if (isDevelopment()) {
            console.log('Attempting token refresh after 401');
          }
          
          const baseUrl = getApiUrl();
          const newAccessToken = await refreshTokenWithRetry(refreshToken, baseUrl, navigate);
          
          if (isDevelopment()) {
            console.log('Token refresh successful');
          }
          
          // Update authorization header
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          
          if (isDevelopment()) {
            console.groupEnd();
          }
          
          return axios(originalRequest);
          
        } catch (refreshError) {
          if (isDevelopment()) {
            console.error('Token refresh completely failed:', refreshError);
            console.groupEnd();
          }
          
          clearTokens();
          navigateToLogin(navigate);
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

      if (isDevelopment()) {
        console.groupEnd();
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
  const { accessToken, refreshToken, tokenExpiry } = getTokens();
  
  // More robust authentication check
  const hasTokens = !!accessToken && !!refreshToken;
  const isValid = hasTokens && !isTokenExpired();
  
  if (isDevelopment()) {
    console.group('Authentication Check');
    console.log('Access Token Exists:', !!accessToken);
    console.log('Refresh Token Exists:', !!refreshToken);
    console.log('Token Expired:', isTokenExpired());
    console.log('Is Authenticated:', isValid);
    console.groupEnd();
  }
  
  return isValid;
};

export const logout = async (navigate) => {
  try {
    console.group('Logout Process');
    console.log('Initiating logout');
    
    // Optional: Send logout request to invalidate token on server
    try {
      const baseUrl = getApiUrl();
      const { refreshToken } = getTokens();
      
      if (refreshToken) {
        await axios.post(`${baseUrl}/api/logout/`, { refresh: refreshToken });
      }
    } catch (logoutError) {
      console.warn('Server logout failed, continuing with local logout:', logoutError);
    }
    
    clearTokens();
    navigateToLogin(navigate);
    
    console.log('Logout completed successfully');
    console.groupEnd();
  } catch (error) {
    console.error('Logout error:', error);
    clearTokens();
    window.location.href = '/login';
  }
};

// Initialize interceptors on first import
setupAxiosInterceptors();