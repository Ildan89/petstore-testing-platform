import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { getToken, clearToken } from './api/client';
import LoginPage from './pages/LoginPage';
import PetsPage from './pages/PetsPage';
import OrdersPage from './pages/OrdersPage';
import SqlPage from './pages/SqlPage';
import LogsPage from './pages/LogsPage';

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
      <strong>🐾 Зоомагазин</strong>
      <Link to="/pets">Питомцы</Link>
      <Link to="/orders">Заказы</Link>
      <Link to="/sql">SQL-консоль</Link>
      <Link to="/logs">Логи</Link>
      <div className="spacer" />
      <button className="secondary" onClick={logout}>Выйти</button>
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/pets"
        element={<RequireAuth><Layout><PetsPage /></Layout></RequireAuth>}
      />
      <Route
        path="/orders"
        element={<RequireAuth><Layout><OrdersPage /></Layout></RequireAuth>}
      />
      <Route
        path="/sql"
        element={<RequireAuth><Layout><SqlPage /></Layout></RequireAuth>}
      />
      <Route
        path="/logs"
        element={<RequireAuth><Layout><LogsPage /></Layout></RequireAuth>}
      />
      <Route path="*" element={<Navigate to="/pets" replace />} />
    </Routes>
  );
}
