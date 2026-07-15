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

const SCHEMA = [
  {
    table: 'users',
    desc: 'Продавцы',
    columns: [
      ['id', 'serial', 'ID продавца'],
      ['username', 'varchar', 'Логин (уникальный)'],
      ['password_hash', 'varchar', 'Хэш пароля'],
      ['created_at', 'timestamptz', 'Дата регистрации'],
    ],
  },
  {
    table: 'categories',
    desc: 'Категории животных',
    columns: [
      ['id', 'serial', 'ID категории'],
      ['name', 'varchar', 'Название'],
    ],
  },
  {
    table: 'pets',
    desc: 'Животные',
    columns: [
      ['id', 'bigint', 'ID животного (большое число)'],
      ['name', 'varchar', 'Имя'],
      ['category_id', 'integer', 'Категория → categories.id'],
      ['status', 'varchar', 'available / pending / sold'],
      ['price', 'numeric', 'Цена, ₽'],
      ['description', 'text', 'Описание'],
      ['seller_id', 'integer', 'Владелец → users.id'],
      ['created_at', 'timestamptz', 'Дата создания'],
      ['updated_at', 'timestamptz', 'Дата обновления'],
    ],
  },
  {
    table: 'orders',
    desc: 'Заказы',
    columns: [
      ['id', 'serial', 'ID заказа'],
      ['pet_id', 'bigint', 'Животное → pets.id'],
      ['seller_id', 'integer', 'Продавец → users.id'],
      ['buyer_name', 'varchar', 'Имя покупателя'],
      ['buyer_phone', 'varchar', 'Телефон покупателя'],
      ['quantity', 'integer', 'Количество'],
      ['status', 'varchar', 'placed / approved / delivered / cancelled'],
      ['placed_at', 'timestamptz', 'Дата оформления'],
    ],
  },
  {
    table: 'logs',
    desc: 'Логи запросов',
    columns: [
      ['id', 'serial', 'ID'],
      ['level', 'varchar', 'INFO / ERROR'],
      ['message', 'text', 'Сообщение'],
      ['endpoint', 'varchar', 'Путь'],
      ['method', 'varchar', 'HTTP-метод'],
      ['sql_query', 'text', 'SQL-запрос к БД'],
      ['db_response', 'text', 'Ответ БД'],
      ['created_at', 'timestamptz', 'Время'],
    ],
  },
];

export default function SqlPage() {
  const [tab, setTab] = useState<'query' | 'schema'>('query');
  const [query, setQuery] = useState('SELECT * FROM pets LIMIT 10');
  const [result, setResult] = useState<SqlResult | null>(null);

  const run = async () => {
    try {
      const res = await api.post<SqlResult>('/sql/execute', { query });
      setResult(res);
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Ошибка' });
    }
  };

  const columns = result?.rows?.[0] ? Object.keys(result.rows[0]) : [];

  return (
    <div>
      <div className="card">
        <div className="tabs">
          <button
            className={tab === 'query' ? 'tab active' : 'tab'}
            onClick={() => setTab('query')}
          >
            Запрос
          </button>
          <button
            className={tab === 'schema' ? 'tab active' : 'tab'}
            onClick={() => setTab('schema')}
          >
            Таблицы
          </button>
        </div>
      </div>

      {tab === 'query' && (
        <>
          <div className="card">
            <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
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
              <strong>{result.error}</strong>
            </div>
          )}

          {result?.rows && (
            <div className="card">
              <p>Строк: {result.rowCount}</p>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i}>
                        {columns.map((c) => (
                          <td key={c}>
                            {row[c] === null ? '—' : String(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'schema' && (
        <>
          {SCHEMA.map((t) => (
            <div className="card" key={t.table}>
              <h3 style={{ marginTop: 0 }}>
                <code>{t.table}</code> — {t.desc}
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>Колонка</th>
                    <th>Тип</th>
                    <th>Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {t.columns.map((c) => (
                    <tr key={c[0]}>
                      <td style={{ fontFamily: 'monospace' }}>{c[0]}</td>
                      <td style={{ color: '#888' }}>{c[1]}</td>
                      <td>{c[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
