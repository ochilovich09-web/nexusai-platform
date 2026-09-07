import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { ToastProvider, Icon } from './components/ui.jsx';
import Shell from './components/Shell.jsx';

import Login from './pages/Login.jsx';
import Chat from './pages/Chat.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ModelStudio from './pages/ModelStudio.jsx';
import KnowledgeBase from './pages/KnowledgeBase.jsx';
import SecurityMonitor from './pages/SecurityMonitor.jsx';
import AgentSwarm from './pages/AgentSwarm.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';

function Splash() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 bg-background">
      <Icon name="graph_3" size={32} className="text-primary animate-pulse" />
      <p className="meta">Sessiya tekshirilmoqda…</p>
    </div>
  );
}

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={loading ? <Splash /> : user ? <Navigate to="/chat" replace /> : <Login />} />
        <Route path="/chat" element={<Private><Chat /></Private>} />
        <Route path="/chat/:id" element={<Private><Chat /></Private>} />
        <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
        <Route path="/models" element={<Private><ModelStudio /></Private>} />
        <Route path="/knowledge" element={<Private><KnowledgeBase /></Private>} />
        <Route path="/security" element={<Private><SecurityMonitor /></Private>} />
        <Route path="/agents" element={<Private><AgentSwarm /></Private>} />
        <Route path="/audit" element={<Private><AuditLogs /></Private>} />
        <Route path="/users" element={<Private><Users /></Private>} />
        <Route path="/settings" element={<Private><Settings /></Private>} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </ToastProvider>
  );
}
