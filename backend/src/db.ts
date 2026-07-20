import { Pool, QueryResult, QueryResultRow } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

const pool = new Pool({
  host: process.env.PGHOST || 'pg4.sweb.ru',
  port: parseInt(process.env.PGPORT || '5433', 10),
  user: process.env.PGUSER || 'ramaldano2',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'ramaldano2',
  max: parseInt(process.env.PG_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
});

// Хранилище SQL-запросов в рамках одного HTTP-запроса (для логирования).
export interface SqlRecord {
  sql: string;
  params?: unknown[];
  rowCount: number | null;
  rows: unknown[];
  error?: string; // текст ошибки БД, если запрос упал
}
export const sqlStore = new AsyncLocalStorage<SqlRecord[]>();

// Форматирование SQL для лога: сохраняем переносы/табуляцию, срезаем пустые края.
const formatSql = (text: string) => text.replace(/^\n+/, '').replace(/\s+$/, '');

// Хранилище stack trace последней ошибки в рамках запроса (для логирования).
export interface ErrorHolder {
  stack?: string;
}
export const errorStore = new AsyncLocalStorage<ErrorHolder>();

// Обёртка над pool.query — записывает SQL и ответ в текущий контекст запроса.
// Логи самой таблицы logs не пишем (чтобы не зациклиться).
async function query<T extends QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  try {
    const result = await pool.query<T>(text, params);
    const store = sqlStore.getStore();
    if (store && !/\blogs\b/i.test(text)) {
      store.push({
        sql: formatSql(text),
        params,
        rowCount: result.rowCount,
        rows: result.rows.slice(0, 20), // не раздуваем ответ
      });
    }
    return result;
  } catch (err: any) {
    // Упавший запрос тоже записываем в лог (с текстом ошибки вместо данных),
    // чтобы в sql_query было видно, ЧТО именно упало.
    const store = sqlStore.getStore();
    if (store && !/\blogs\b/i.test(text)) {
      store.push({
        sql: formatSql(text),
        params,
        rowCount: null,
        rows: [],
        error: err.message,
      });
    }
    // Сохраняем stack ошибки БД в контекст запроса — логгер его подхватит
    const holder = errorStore.getStore();
    if (holder) holder.stack = err.stack || String(err);
    throw err;
  }
}

export default { query };
