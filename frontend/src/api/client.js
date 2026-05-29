import axios from 'axios';

// In development, Vite proxies /api → localhost:3001 automatically.
// In production, set VITE_API_URL to your backend domain.
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pb_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pb_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
