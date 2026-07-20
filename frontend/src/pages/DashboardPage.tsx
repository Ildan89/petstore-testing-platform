import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { DashboardStats } from '../api/types';
import { useSnackbar } from '../components/Snackbar';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const { notify } = useSnackbar();

  useEffect(() => {
    api
      .get<DashboardStats>('/dashboard')
      .then(setStats)
      .catch((e) => notify(e.message));
  }, [notify]);

  return (
    <div>
      <h2>Дашборд</h2>
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
