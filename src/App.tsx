import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Spinner } from './components/ui';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import AccountDetail from './pages/AccountDetail';
import AdminPanel from './pages/AdminPanel';
import TransferPage from './pages/TransferPage';
import DepositPage from './pages/DepositPage';
import CryptoPage from './pages/CryptoPage';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
import ProfilePage from './pages/ProfilePage';

function SessionLoader() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center" role="status" aria-live="polite">
      <Spinner className="w-8 h-8" label="Restoring your session" />
    </div>
  );
}

function Protected({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <SessionLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <SessionLoader />;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <AuthPage mode="login" />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <AuthPage mode="signup" />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/account/:id" element={<Protected><AccountDetail /></Protected>} />
      <Route path="/account/:id/history" element={<Protected><TransactionHistoryPage /></Protected>} />
      <Route path="/transfers" element={<Protected><TransferPage /></Protected>} />
      <Route path="/deposits" element={<Protected><DepositPage /></Protected>} />
      <Route path="/crypto" element={<Protected><CryptoPage /></Protected>} />
      <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
      <Route path="/admin/*" element={<Protected adminOnly><AdminPanel /></Protected>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
