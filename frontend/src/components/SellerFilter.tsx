import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface UserRow {
  id: number;
  username: string;
}

// Фильтр по продавцам (только для админа). Список берём из /api/users.
export function SellerFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [sellers, setSellers] = useState<UserRow[]>([]);

  useEffect(() => {
    api
      .get<UserRow[]>('/users')
      .then((rows) =>
        setSellers(
          (rows || [])
            .filter((u) => u.id !== 0)
            .sort((a, b) => a.username.localeCompare(b.username, 'ru'))
        )
      )
      .catch(() => {});
  }, []);

  return (
    <label className="page-size">
      Продавец:
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Все продавцы</option>
        {sellers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.username}
          </option>
        ))}
      </select>
    </label>
  );
}
