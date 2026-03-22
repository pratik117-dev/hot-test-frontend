import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) => api.post('/auth/register', { email, password, name }),
  me: () => api.get('/auth/me'),
};

// Devices
export const devicesApi = {
  getAll: () => api.get('/devices'),
  getOne: (id: string) => api.get(`/devices/${id}`),
  create: (data: any) => api.post('/devices', data),
  update: (id: string, data: any) => api.put(`/devices/${id}`, data),
  delete: (id: string) => api.delete(`/devices/${id}`),
  getStats: () => api.get('/devices/stats/dashboard'),
};

// Sensor data
export const dataApi = {
  getAll: (params?: any) => api.get('/data', { params }),
  getLatest: () => api.get('/data/latest'),
  getTimeSeries: (params?: any) => api.get('/data/timeseries', { params }),
};

// Alerts
export const alertsApi = {
  getAll: (params?: any) => api.get('/alerts', { params }),
  resolve: (id: string) => api.patch(`/alerts/${id}/resolve`),
  resolveAll: (deviceId: string) => api.patch(`/alerts/device/${deviceId}/resolve-all`),
};

// Reports
export const reportsApi = {
  getSummary: (params?: any) => api.get('/reports/summary', { params }),
  exportCSV: (params?: any) => api.get('/reports/export', { params, responseType: 'blob' }),
};

// Admin
export const adminApi = {
  getUsers: () => api.get('/admin/users'),
  updateUserRole: (id: string, role: string) => api.patch(`/admin/users/${id}/role`, { role }),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  getLogs: (params?: any) => api.get('/admin/logs', { params }),
  getStats: () => api.get('/admin/stats'),
};
