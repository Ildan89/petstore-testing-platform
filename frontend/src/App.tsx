import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { getToken, clearToken } from './api/client';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PetsPage from './pages/PetsPage';
import OrdersPage from './pages/OrdersPage';
import SqlPage from './pages/SqlPage';
import LogsPage from './pages/LogsPage';
import DocsPage from './pages/DocsPage';
import TaskPage from './pages/TaskPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  // BUG: проверяем только наличие токена, не его валидность/срок.
  // Протухший токен → пускает в UI, а запросы падают с 401.
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function Nav() {
  const navigate = useNavigate();
  const logout = () => {
    clearToken();
    navigate('/login');
  };
  return (
    <div className="nav">
      <Link to="/task" className="logo">
        <span className="logo-icon">
          <svg viewBox="0 0 64 64" width="30" height="30" fill="#8B5A2B" aria-hidden="true">
            <ellipse cx="32" cy="44" rx="14" ry="11" />
            <ellipse cx="14" cy="30" rx="6.5" ry="8.5" />
            <ellipse cx="26" cy="20" rx="6" ry="8.5" />
            <ellipse cx="38" cy="20" rx="6" ry="8.5" />
            <ellipse cx="50" cy="30" rx="6.5" ry="8.5" />
          </svg>
        </span>
        <span className="logo-text">
          <span className="logo-title">ЗооМаркет</span>
          <span className="logo-sub">CRM для продавцов</span>
        </span>
      </Link>
      <div className="nav-links">
        <Link to="/dashboard">📊 Дашборд</Link>
        <Link to="/pets">🐕 Питомцы</Link>
        <Link to="/orders">🛒 Заказы</Link>
      </div>
      <div className="spacer" />
      <Link to="/sql" className="nav-right">🗄️ SQL-консоль</Link>
      <Link to="/logs" className="nav-right">📜 Логи</Link>
      <Link to="/task" className="nav-right">📋 Задание</Link>
      <Link to="/docs" className="nav-right">📖 Дока</Link>
      <button className="secondary" onClick={logout}>Выйти →</button>
    </div>
  );
}

function Layout({ children }: { children: JSX.Element }) {
  return (
    <>
      <Nav />
      <div className="container">{children}</div>
    </>
  );
}

function protectedRoute(el: JSX.Element) {
  return (
    <RequireAuth>
      <Layout>{el}</Layout>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={protectedRoute(<DashboardPage />)} />
      <Route path="/pets" element={protectedRoute(<PetsPage />)} />
      <Route path="/orders" element={protectedRoute(<OrdersPage />)} />
      <Route path="/sql" element={protectedRoute(<SqlPage />)} />
      <Route path="/logs" element={protectedRoute(<LogsPage />)} />
      <Route path="/docs" element={protectedRoute(<DocsPage />)} />
      <Route path="/task" element={protectedRoute(<TaskPage />)} />
      <Route path="*" element={<Navigate to="/task" replace />} />
    </Routes>
  );
}
