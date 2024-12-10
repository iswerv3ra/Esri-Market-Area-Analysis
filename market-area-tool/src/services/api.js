// src/services/api.js

import axios from 'axios';
import { getApiUrl, getStoredToken, setAuthToken, refreshToken } from '../utils/auth';
import { withRetry } from '../utils/retry';

const baseURL = getApiUrl();

// Debug configuration in development
if (import.meta.env.DEV) {
  console.log('API Service Configuration:', {
    baseURL,
    mode: import.meta.env.MODE,
    isDev: import.meta.env.DEV
  });
}

// Create axios instances
const authAxios = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set up initial token if it exists
const token = getStoredToken();
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  authAxios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Track refresh token promise
let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const onRefreshed = (token) => {
  refreshSubscribers.map(callback => callback(token));
  refreshSubscribers = [];
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    const isAuthEndpoint = [
      '/api/token/',
      '/api/token/refresh/',
      '/api/token/verify/'
    ].some(endpoint => config.url.includes(endpoint));

    if (token && !isAuthEndpoint) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (!config.url.endsWith('/')) {
      config.url += '/';
    }

    if (import.meta.env.DEV) {
      console.log('Making request:', {
        url: `${config.baseURL}${config.url}`,
        method: config.method,
        headers: config.headers,
        data: config.data
      });
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log('Response received:', {
        status: response.status,
        data: response.data
      });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(resolve => {
          subscribeTokenRefresh(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const token = await refreshToken();
        onRefreshed(token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authAPI = {
  login: async (credentials) => {
    try {
      const response = await authAxios.post('/api/token/', credentials);
      const { access, refresh } = response.data;
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);
      setAuthToken(access);
      return response;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },
  
  register: async (userData) => {
    try {
      return await authAxios.post('/api/user/register/', userData);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  },

  refreshToken: async (refreshToken) => {
    try {
      return await authAxios.post('/api/token/refresh/', { refresh: refreshToken });
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  },

  verifyToken: async (token) => {
    try {
      await authAxios.post('/api/token/verify/', { token });
      return true;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }
};

// Projects API endpoints
export const projectsAPI = {
  getAll: async () => {
    return withRetry(async () => {
      try {
        const response = await api.get('/api/projects/');
        return response;
      } catch (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }
    });
  },

  create: async (projectData) => {
    return withRetry(async () => {
      try {
        const response = await api.post('/api/projects/', projectData);
        return response;
      } catch (error) {
        console.error('Error creating project:', error);
        throw error;
      }
    });
  },

  getById: async (id) => {
    return withRetry(async () => {
      try {
        const response = await api.get(`/api/projects/${id}/`);
        return response;
      } catch (error) {
        console.error(`Error fetching project ${id}:`, error);
        throw error;
      }
    });
  },

  update: async (id, projectData) => {
    return withRetry(async () => {
      try {
        const response = await api.put(`/api/projects/${id}/`, projectData);
        return response;
      } catch (error) {
        console.error(`Error updating project ${id}:`, error);
        throw error;
      }
    });
  },

  delete: async (id) => {
    return withRetry(async () => {
      try {
        const response = await api.delete(`/api/projects/${id}/`);
        return response;
      } catch (error) {
        console.error(`Error deleting project ${id}:`, error);
        throw error;
      }
    });
  }
};

// Style Presets API endpoints
export const stylePresetsAPI = {
  getAll: async () => {
    return withRetry(async () => {
      try {
        const response = await api.get('/api/style-presets/');
        if (!response.data) {
          console.warn('Style presets response is empty');
          return { data: [] };
        }
        return response;
      } catch (error) {
        console.error('Error fetching style presets:', error);
        if (error.response?.status === 500) {
          return { data: [] };
        }
        throw error;
      }
    });
  },

  create: async (presetData) => {
    return withRetry(async () => {
      try {
        const response = await api.post('/api/style-presets/', presetData);
        return response;
      } catch (error) {
        console.error('Error creating style preset:', error);
        throw error;
      }
    });
  },

  update: async (id, presetData) => {
    return withRetry(async () => {
      try {
        const response = await api.put(`/api/style-presets/${id}/`, presetData);
        return response;
      } catch (error) {
        console.error(`Error updating style preset ${id}:`, error);
        throw error;
      }
    });
  },

  delete: async (id) => {
    return withRetry(async () => {
      try {
        const response = await api.delete(`/api/style-presets/${id}/`);
        return response;
      } catch (error) {
        console.error(`Error deleting style preset ${id}:`, error);
        throw error;
      }
    });
  },

  makeGlobal: async (id) => {
    return withRetry(async () => {
      try {
        const response = await api.post(`/api/style-presets/${id}/make_global/`);
        return response;
      } catch (error) {
        console.error(`Error making style preset ${id} global:`, error);
        throw error;
      }
    });
  }
};

// Variable Presets API endpoints
export const variablePresetsAPI = {
  getAll: async () => {
    return withRetry(async () => {
      try {
        const response = await api.get('/api/variable-presets/');
        if (!response.data) {
          console.warn('Variable presets response is empty');
          return { data: [] };
        }
        return response;
      } catch (error) {
        console.error('Error fetching variable presets:', error);
        if (error.response?.status === 500) {
          return { data: [] };
        }
        throw error;
      }
    });
  },

  create: async (presetData) => {
    return withRetry(async () => {
      try {
        console.log('Creating variable preset:', presetData);
        const response = await api.post('/api/variable-presets/', presetData);
        console.log('Variable preset created:', response.data);
        return response;
      } catch (error) {
        console.error('Error creating variable preset:', error);
        throw error;
      }
    });
  },

  update: async (id, presetData) => {
    return withRetry(async () => {
      try {
        const response = await api.put(`/api/variable-presets/${id}/`, presetData);
        return response;
      } catch (error) {
        console.error(`Error updating variable preset ${id}:`, error);
        throw error;
      }
    });
  },

  delete: async (id) => {
    return withRetry(async () => {
      try {
        const response = await api.delete(`/api/variable-presets/${id}/`);
        return response;
      } catch (error) {
        console.error(`Error deleting variable preset ${id}:`, error);
        throw error;
      }
    });
  },

  makeGlobal: async (id) => {
    return withRetry(async () => {
      try {
        const response = await api.post(`/api/variable-presets/${id}/make_global/`);
        return response;
      } catch (error) {
        console.error(`Error making variable preset ${id} global:`, error);
        throw error;
      }
    });
  }
};

// ArcGIS enrichment service
export const enrichmentAPI = {
  getToken: async () => {
    try {
      const params = new URLSearchParams({
        client_id: import.meta.env.VITE_ARCGIS_CLIENT_ID,
        client_secret: import.meta.env.VITE_ARCGIS_CLIENT_SECRET,
        grant_type: 'client_credentials',
        f: 'json'
      });

      const response = await axios.post(
        'https://www.arcgis.com/sharing/rest/oauth2/token',
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (response.data.error) {
        throw new Error(`ArcGIS token error: ${response.data.error.message}`);
      }

      return response.data.access_token;
    } catch (error) {
      console.error('ArcGIS token generation failed:', error);
      throw error;
    }
  },

  enrichArea: async (geometry, variables) => {
    return withRetry(async () => {
      try {
        const token = await enrichmentAPI.getToken();
        
        const params = new URLSearchParams({
          f: 'json',
          token: token,
          studyAreas: JSON.stringify([{
            geometry,
            areaType: "RingBuffer",
            bufferUnits: "esriMiles",
            bufferRadii: [0]
          }]),
          analysisVariables: JSON.stringify(variables)
        });

        const response = await axios.post(
          'https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/enrich',
          params,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );

        if (response.data.error) {
          throw new Error(`Enrichment error: ${response.data.error.message}`);
        }

        return response.data;
      } catch (error) {
        console.error('Enrichment request failed:', error);
        throw error;
      }
    });
  }
};

export default api;