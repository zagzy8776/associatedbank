import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { Spinner } from './components/ui';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import AccountDetail from './pages/AccountDetail';
import AdminPanel from './pages/AdminPanel';
import AdminLoginPage from './pages/AdminLoginPage';
import TransferPage from './pages/TransferPage';
import DepositPage from './pages/DepositPage';
import CryptoPage from './pages/CryptoPage';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
import ProfilePage from './pages/ProfilePage';

function SessionLoader() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center" role="status" aria-live="polite">
      <Spinner className="w-8 h-8" label="Loading" />
    </div>
  );
}

// Customer route guard
function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SessionLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Admin route guard — uses separate admin auth
function AdminProtected({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAdminAuth();
  if (loading) return <SessionLoader />;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

// Customer routes (wrapped in customer auth)
function CustomerRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/account/:id" element={<Protected><AccountDetail /></Protected>} />
      <Route path="/account/:id/history" element={<Protected><TransactionHistoryPage /></Protected>} />
      <Route path="/transfers" element={<Protected><TransferPage /></Protected>} />
      <Route path="/deposits" element={<Protected><DepositPage /></Protected>} />
      <Route path="/crypto" element={<Protected><CryptoPage /></Protected>} />
      <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
    </Routes>
  );
}

// Admin routes (wrapped in admin auth)
function AdminRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route path="/*" element={<AdminProtected><AdminPanel /></AdminProtected>} />
    </Routes>
  );
}

export default function App() {
  const { loading: customerLoading } = useAuth();

  if (customerLoading) return <SessionLoader />;

  return (
    <Routes>
      {/* Admin routes — completely separate */}
      <Route path="/admin/*" element={
        <AdminAuthProvider>
          <AdminRoutes />
        </AdminAuthProvider>
      } />

      {/* Customer routes */}
      <Route path="/*" element={<CustomerRoutes />} />
    </Routes>
  );
}
