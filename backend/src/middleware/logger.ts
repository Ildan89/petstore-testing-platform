import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import pool, { sqlStore, SqlRecord } from '../db';
import fs from 'fs';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_LIMIT = parseInt(process.env.LOG_LIMIT || '2000', 10);

// Ensure log directory exists
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}

export function logToFile(level: string, message: string, meta?: Record<string, unknown>): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  }) + '\n';
  const date = new Date().toISOString().slice(0, 10);
  fs.appendFileSync(path.join(LOG_DIR, `app-${date}.log`), line);
}

let sinceLastTrim = 0;
async function trimLogs(): Promise<void> {
  // Держим не более LOG_LIMIT записей — удаляем старые. Проверяем не каждый раз.
  sinceLastTrim++;
  if (sinceLastTrim < 20) return;
  sinceLastTrim = 0;
  try {
    await pool.query(
      `DELETE FROM logs WHERE id IN (
         SELECT id FROM logs ORDER BY id DESC OFFSET $1
       )`,
      [LOG_LIMIT]
    );
  } catch {
    // ignore
  }
}

export async function logToDb(
  level: string,
  message: string,
  endpoint: string | undefined,
  method: string | undefined,
  userId: number | undefined,
  ip: string | undefined,
  details: Record<string, unknown> | undefined,
  sqlQuery?: string,
  dbResponse?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO logs (level, message, endpoint, method, user_id, ip, details, sql_query, db_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        level,
        message,
        endpoint,
        method,
        userId,
        ip,
        details ? JSON.stringify(details) : null,
        sqlQuery ?? null,
        dbResponse ?? null,
      ]
    );
    await trimLogs();
  } catch {
    // Silently fail — logging shouldn't break the app
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const records: SqlRecord[] = [];
  const requestId = randomUUID();

  // Перехватываем тело ответа, чтобы достать текст ошибки (поле error)
  let responseBody: unknown;
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'ERROR' : 'INFO';

    // accountId: id продавца из токена, либо anonymous
    const accountId = req.user?.userId != null ? String(req.user.userId) : 'anonymous';

    // Текст ошибки из тела ответа (если есть)
    let errorText = '';
    if (
      responseBody &&
      typeof responseBody === 'object' &&
      'error' in (responseBody as Record<string, unknown>)
    ) {
      errorText = String((responseBody as Record<string, unknown>).error);
    }

    // Двухстрочное сообщение:
    // 1) requestId, accountId, метод url статус
    // 2) текст ошибки (если есть)
    const line1 = `requestId=${requestId} accountId=${accountId} | ${req.method} ${req.path} ${res.statusCode}`;
    const message = errorText ? `${line1}\n${errorText}` : line1;

    const sqlQuery = records.map((r) => r.sql).join(';\n');
    const dbResponse = JSON.stringify(
      records.map((r) => ({ rowCount: r.rowCount, rows: r.rows })),
    );

    logToFile(level, message, {
      requestId,
      accountId,
      endpoint: req.path,
      method: req.method,
      duration,
      statusCode: res.statusCode,
      ip: req.ip || req.socket.remoteAddress,
      error: errorText || undefined,
      sql: sqlQuery,
    });

    logToDb(
      level,
      message,
      req.path,
      req.method,
      req.user?.userId,
      req.ip || req.socket.remoteAddress,
      { requestId, accountId, duration, statusCode: res.statusCode, query: req.query, body: req.body },
      sqlQuery || undefined,
      dbResponse,
    );
  });

  // Выполняем обработчик внутри контекста, куда db.query складывает записи
  sqlStore.run(records, () => next());
}
