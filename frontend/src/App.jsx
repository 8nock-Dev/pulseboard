import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import MonitorDetail from './pages/MonitorDetail';
import StatusPage   from './pages/StatusPage';

function PrivateRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-stone-400 font-mono text-sm">Loading...</div>
      </div>
    );
  }

  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"            element={<Login />} />
      <Route path="/status/:userId"   element={<StatusPage />} />
      <Route path="/"                 element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/monitors/:id"     element={<PrivateRoute><MonitorDetail /></PrivateRoute>} />
      <Route path="*"                 element={<Navigate to="/" replace />} />
    </Routes>
  );
}
