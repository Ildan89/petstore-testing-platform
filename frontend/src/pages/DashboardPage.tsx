import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { DashboardStats } from '../api/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<DashboardStats>('/dashboard')
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2>Дашборд</h2>
      {error && <div className="error">{error}</div>}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{stats?.pets ?? '—'}</div>
          <div className="stat-label">Животных</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.orders ?? '—'}</div>
          <div className="stat-label">Заказов</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {stats ? `${stats.salesTotal.toLocaleString('ru-RU')} ₽` : '—'}
          </div>
          <div className="stat-label">Сумма продаж</div>
        </div>
      </div>
    </div>
  );
}
