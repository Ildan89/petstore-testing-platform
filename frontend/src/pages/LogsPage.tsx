import { useState } from 'react';
import { api } from '../api/client';
import type { LogEntry } from '../api/types';
import { PageSizeSelect, apiLimit, DEFAULT_PAGE_SIZE } from '../components/PageSize';

interface LogsResponse {
  source: string;
  count: number;
  data: LogEntry[];
}

export default function LogsPage() {
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<'db' | 'file'>('db');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [count, setCount] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = async (size = pageSize) => {
    setError('');
    const params = new URLSearchParams();
    if (level) params.set('level', level);
    if (search) params.set('search', search);
    params.set('source', source);
    params.set('limit', String(apiLimit(size)));
    try {
      const res = await api.get<LogsResponse>(`/logs?${params.toString()}`);
      setLogs(res.data || []);
      setCount(res.count || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
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
          <button onClick={() => load()}>Искать</button>
          <PageSizeSelect
            value={pageSize}
            onChange={(v) => { setPageSize(v); load(v); }}
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <p>Найдено: {count} (источник: {source})</p>
        <table>
          <thead>
            <tr>
              <th>Время</th>
              <th>Уровень</th>
              <th>Сообщение</th>
              <th>SQL</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={i} onClick={() => setExpanded(expanded === i ? null : i)} style={{ cursor: 'pointer' }}>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                  {log.created_at || log.timestamp}
                </td>
                <td>
                  <span style={{ color: log.level === 'ERROR' ? '#c62828' : '#666', fontWeight: 600 }}>
                    {log.level}
                  </span>
                </td>
                <td>
                  <span style={{ whiteSpace: 'pre-line', fontSize: 13 }}>{log.message}</span>
                  {expanded === i && log.sql_query && (
                    <pre className="code-block small" style={{ marginTop: 6 }}>
                      {log.sql_query}
                      {log.db_response ? `\n\n-- ответ БД:\n${log.db_response}` : ''}
                    </pre>
                  )}
                </td>
                <td style={{ fontSize: 11, color: '#888', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.sql_query ? log.sql_query.slice(0, 40) + '…' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
