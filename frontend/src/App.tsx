import { useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { getToken, clearToken } from './api/client';
import { PawIcon } from './components/Logo';
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

// Основные разделы (слева) и инструменты (справа)
const NAV_MAIN = [
  { to: '/dashboard', label: '📊 Дашборд' },
  { to: '/pets', label: '🐕 Питомцы' },
  { to: '/orders', label: '🛒 Заказы' },
];
const NAV_TOOLS = [
  { to: '/sql', label: '🗄️ SQL-консоль' },
  { to: '/logs', label: '📜 Логи' },
  { to: '/task', label: '📋 Задание' },
  { to: '/docs', label: '📖 Дока' },
];

function Nav() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const logout = () => {
    clearToken();
    navigate('/login');
  };
  const close = () => setOpen(false);

  return (
    <div className="nav">
      <Link to="/task" className="logo" onClick={close}>
        <span className="logo-icon">
          <PawIcon size={30} />
        </span>
        <span className="logo-text">
          <span className="logo-title">ЗооМаркет</span>
          <span className="logo-sub">CRM для продавцов</span>
        </span>
      </Link>

      <button
        className="nav-burger"
        onClick={() => setOpen(!open)}
        aria-label="Меню"
      >
        {open ? '✕' : '☰'}
      </button>

      <div className={open ? 'nav-menu open' : 'nav-menu'}>
        <div className="nav-group nav-group-main">
          {NAV_MAIN.map((item) => (
            <Link key={item.to} to={item.to} onClick={close}>
              {item.label}
            </Link>
          ))}
        </div>
        <div className="nav-group nav-group-tools">
          {NAV_TOOLS.map((item) => (
            <Link key={item.to} to={item.to} onClick={close}>
              {item.label}
            </Link>
          ))}
          <button className="secondary nav-logout" onClick={() => { close(); logout(); }}>
            Выйти →
          </button>
        </div>
      </div>
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
