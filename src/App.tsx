import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider }      from './context/AuthContext';
import { ThemeProvider }     from './context/ThemeContext';
import { WebSocketProvider } from './context/WebSocketContext';
import ProtectedRoute        from './components/layout/ProtectedRoute';
import AppLayout             from './components/layout/AppLayout';
import LoginPage             from './pages/LoginPage';
import RegisterPage          from './pages/RegisterPage';
import DashboardPage         from './pages/DashboardPage';
import DevicesPage           from './pages/DevicesPage';
import MonitoringPage        from './pages/MonitoringPage';
import AlertsPage            from './pages/AlertsPage';
import ReportsPage           from './pages/ReportsPage';
import AdminPage             from './pages/AdminPage';
import MqttSettingsPage      from './pages/MqttSettingsPage';
import NotFoundPage          from './pages/NotFoundPage';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          <BrowserRouter>
            <Toaster
  position="top-right"
  toastOptions={{
    className: '!hidden',
    duration:  0,
    // Per-type overrides (belt-and-suspenders)
    error:   { className: '!hidden', duration: 0 },
    success: { className: '!hidden', duration: 0 },
    loading: { className: '!hidden', duration: 0 },
    blank:   { className: '!hidden', duration: 0 },
  }}
/>
            <Routes>
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard"  element={<DashboardPage />} />
                <Route path="devices"    element={<DevicesPage />} />
                <Route path="monitoring" element={<MonitoringPage />} />
                <Route path="alerts"     element={<AlertsPage />} />
                <Route path="reports"    element={<ReportsPage />} />
                <Route path="mqtt"       element={<MqttSettingsPage />} />
                <Route path="admin"      element={<AdminPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
