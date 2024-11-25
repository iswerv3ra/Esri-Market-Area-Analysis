import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor
api.interceptors.request.use(
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

// Add a response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error status is 401 and there has been no retry yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_URL}/api/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        localStorage.setItem('accessToken', access);

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return axios(originalRequest);
      } catch (error) {
        // If refresh token fails, logout user
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