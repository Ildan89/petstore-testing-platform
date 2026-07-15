import { useState } from 'react';
import { api } from '../api/client';
import type { LogEntry } from '../api/types';

interface LogsResponse {
  source: string;
  count: number;
  data: LogEntry[];
}

export default function LogsPage() {
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<'db' | 'file'>('db');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [count, setCount] = useState(0);

  const load = async () => {
    const params = new URLSearchParams();
    if (level) params.set('level', level);
    if (search) params.set('search', search);
    params.set('source', source);
    const res = await api.get<LogsResponse>(`/logs?${params.toString()}`);
    setLogs(res.data || []);
    setCount(res.count || 0);
  };

  return (
    <div>
      <div className="card">
        <h2>Просмотр логов</h2>
        <div className="row">
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Все уровни</option>
            <option value="INFO">INFO</option>
            <option value="ERROR">ERROR</option>
            <option value="WARN">WARN</option>
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value as 'db' | 'file')}>
            <option value="db">Из БД</option>
            <option value="file">Из файлов</option>
          </select>
          <input
            placeholder="Поиск по сообщению..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <button onClick={load}>Искать</button>
        </div>
      </div>

      <div className="card">
        <p>Найдено: {count} (источник: {source})</p>
        <table>
          <thead>
            <tr>
              <th>Время</th>
              <th>Уровень</th>
              <th>Сообщение</th>
              <th>Endpoint</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={i}>
                {/* BUG: время из БД (created_at) и из файла (timestamp) — разные поля,
                    для одного из источников колонка всегда пустая */}
                <td>{log.created_at || log.timestamp}</td>
                <td>
                  <span
                    style={{
                      color: log.level === 'ERROR' ? '#c62828' : '#666',
                      fontWeight: 600,
                    }}
                  >
                    {log.level}
                  </span>
                </td>
                <td>{log.message}</td>
                <td>{log.endpoint || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
