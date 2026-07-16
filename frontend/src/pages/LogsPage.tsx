import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { LogEntry } from '../api/types';
import { PageSizeSelect, apiLimit, DEFAULT_PAGE_SIZE } from '../components/PageSize';

interface LogsResponse {
  count: number;
  data: LogEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// Блок-превью с раскрытием по клику
function ExpandBlock({ label, preview, full }: { label: string; preview: string; full: string }) {
  const [open, setOpen] = useState(false);
  const oneLine = preview.replace(/\s+/g, ' ').trim();
  return (
    <div className="log-block">
      <div className="log-block-head" onClick={() => setOpen(!open)}>
        <span className="log-block-arrow">{open ? '▾' : '▸'}</span>
        <span className="log-block-label">{label}</span>
        {!open && <span className="log-block-preview">{oneLine.slice(0, 60)}…</span>}
      </div>
      {open && <pre className="code-block small">{full}</pre>}
    </div>
  );
}

export default function LogsPage() {
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    const params = new URLSearchParams();
    if (level) params.set('level', level);
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('limit', String(apiLimit(pageSize)));
    try {
      const res = await api.get<LogsResponse>(`/logs?${params.toString()}`);
      setLogs(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  // автозагрузка при открытии и при смене фильтров/страницы
  useEffect(() => {
    load();
  }, [level, search, page, pageSize]);

  const totalPages = Math.ceil(total / pageSize);

  const doSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div>
      <div className="card">
        <h2>Просмотр логов</h2>
        <form onSubmit={doSearch} className="row">
          <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
            <option value="">Все уровни</option>
            <option value="INFO">INFO</option>
            <option value="ERROR">ERROR</option>
          </select>
          <input
            placeholder="Поиск по сообщению..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit">Искать</button>
          {search && (
            <button
              type="button"
              className="secondary"
              onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
            >
              Сбросить
            </button>
          )}
        </form>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <p>Всего логов: {total}</p>
        <table>
          <thead>
            <tr>
              <th style={{ width: 170 }}>Время</th>
              <th style={{ width: 70 }}>Уровень</th>
              <th>Сообщение</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12, verticalAlign: 'top' }}>
                  {log.created_at || log.timestamp}
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  <span style={{ color: log.level === 'ERROR' ? '#c62828' : '#666', fontWeight: 600 }}>
                    {log.level}
                  </span>
                </td>
                <td>
                  <div style={{ whiteSpace: 'pre-line', fontSize: 13 }}>{log.message}</div>

                  {log.sql_query && (
                    <ExpandBlock
                      label="SQL"
                      preview={log.sql_query}
                      full={
                        log.sql_query +
                        (log.db_response ? `\n\n-- ответ БД:\n${log.db_response}` : '')
                      }
                    />
                  )}

                  {log.stack && (
                    <ExpandBlock label="Stack trace" preview={log.stack} full={log.stack} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row" style={{ marginTop: 16, justifyContent: 'center' }}>
          <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Назад
          </button>
          <span>Страница {page} из {totalPages || 1}</span>
          <button className="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Вперёд →
          </button>
          <PageSizeSelect value={pageSize} onChange={(v) => { setPageSize(v); setPage(1); }} />
        </div>
      </div>
    </div>
  );
}
