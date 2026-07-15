import { useState } from 'react';
import { api } from '../api/client';

interface SqlResult {
  rows?: Record<string, unknown>[];
  rowCount?: number;
  fields?: { name: string }[];
  error?: string;
  detail?: string;
  hint?: string;
}

const EXAMPLES = [
  'SELECT * FROM pets LIMIT 10',
  'SELECT status, COUNT(*) FROM pets GROUP BY status',
  'SELECT c.name, COUNT(p.id) FROM categories c LEFT JOIN pets p ON p.category_id = c.id GROUP BY c.name',
];

export default function SqlPage() {
  const [query, setQuery] = useState('SELECT * FROM pets LIMIT 10');
  const [result, setResult] = useState<SqlResult | null>(null);

  const run = async () => {
    const res = await api.post<SqlResult>('/sql/execute', { query });
    setResult(res);
  };

  const columns = result?.rows?.[0] ? Object.keys(result.rows[0]) : [];

  return (
    <div>
      <div className="card">
        <h2>SQL-консоль</h2>
        <p style={{ color: '#666', fontSize: 13 }}>
          Разрешены только SELECT-запросы (с JOIN и агрегатами).
        </p>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: '100%', height: 120, fontFamily: 'monospace' }}
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button onClick={run}>Выполнить</button>
          {EXAMPLES.map((ex, i) => (
            <button key={i} className="secondary" onClick={() => setQuery(ex)}>
              Пример {i + 1}
            </button>
          ))}
        </div>
      </div>

      {result?.error && (
        <div className="error">
          {/* BUG: показываем сырую ошибку БД включая detail/hint (утечка структуры) */}
          <strong>{result.error}</strong>
          {result.detail && <div>{result.detail}</div>}
          {result.hint && <div>Подсказка: {result.hint}</div>}
        </div>
      )}

      {result?.rows && (
        <div className="card">
          <p>Строк: {result.rowCount}</p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      // BUG: значения рендерятся как String(value), объекты → [object Object]
                      <td key={c}>{String(row[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
