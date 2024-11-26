import axios from 'axios';

// When in Choreo, use the relative path
// When in development, use the full URL from env
const API_URL = window.location.hostname.includes('choreoapps.dev') 
  ? '/market-area-analysis/backend/v1' 
  : import.meta.env.VITE_API_URL;

// Add debugging to see what URL is being used
console.log('API URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor with debugging
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Debug log the full URL being requested
    console.log('Making request to:', `${config.baseURL}${config.url}`);
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor remains the same
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_URL}/api/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        localStorage.setItem('accessToken', access);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return axios(originalRequest);
      } catch (error) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/api/token/', credentials),
  register: (userData) => api.post('/api/user/register/', userData),
  refreshToken: (refreshToken) => api.post('/api/token/refresh/', { refresh: refreshToken }),
};

export const projectsAPI = {
  getAll: () => api.get('/api/projects/'),
  getById: (id) => api.get(`/api/projects/${id}/`),
  create: (projectData) => api.post('/api/projects/', projectData),
  update: (id, projectData) => api.put(`/api/projects/${id}/`, projectData),
  delete: (id) => api.delete(`/api/projects/${id}/`),
};

export default api;