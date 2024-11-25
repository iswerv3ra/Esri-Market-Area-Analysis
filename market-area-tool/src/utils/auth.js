import axios from 'axios';

const BASE_URL = 'http://localhost:8000/api';

export const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

export const verifyToken = async (token) => {
  try {
    await axios.post(`${BASE_URL}/token/verify/`, { token });
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
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
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

          const response = await axios.post(`${BASE_URL}/token/refresh/`, {
            refresh: refreshToken
          });

          const { access } = response.data;
          localStorage.setItem('accessToken', access);
          setAuthToken(access);

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

  return () => {
    axios.interceptors.request.eject(requestInterceptor);
    axios.interceptors.response.eject(responseInterceptor);
  };
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('accessToken');
};

export const logout = async (navigate) => {
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
};