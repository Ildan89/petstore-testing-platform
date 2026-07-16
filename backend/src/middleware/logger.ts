import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import pool, { sqlStore, SqlRecord, errorStore, ErrorHolder } from '../db';
import fs from 'fs';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_LIMIT = parseInt(process.env.LOG_LIMIT || '2000', 10);

// Ensure log directory exists
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}

// Маскируем чувствительные поля (пароли) в теле запроса перед логированием
const SENSITIVE = ['password', 'confirm_password'];
function maskSensitive(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  const copy: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  for (const key of Object.keys(copy)) {
    if (SENSITIVE.includes(key.toLowerCase())) copy[key] = '***';
  }
  return copy;
}

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
  dbResponse?: string,
  stack?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO logs (level, message, endpoint, method, user_id, ip, details, sql_query, db_response, stack)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
        stack ?? null,
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
  const errorHolder: ErrorHolder = {};
  const requestId = randomUUID();

  // Полный путь и метод фиксируем ДО роутинга (внутри finish req.path укорочен роутером)
  const fullUrl = req.originalUrl.split('?')[0];
  const method = req.method;
  const reqQuery = req.query;
  const reqBody = req.body;

  // Перехватываем тело ответа, чтобы достать текст ошибки (поле error)
  let responseBody: unknown;
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    // Не логируем: действия админа (id=0) и health-check без параметров.
    // health с параметрами (напр. ?from=sweb-cron) логируем — для отслеживания.
    // Админ определяется по токену (req.user) ИЛИ по id=0 в теле ответа (вход/регистрация).
    const bodyId =
      responseBody && typeof responseBody === 'object'
        ? (responseBody as Record<string, unknown>).id
        : undefined;
    const isAdmin = req.user?.userId === 0 || bodyId === 0;
    const isPlainHealth =
      fullUrl === '/api/health' && (!reqQuery || Object.keys(reqQuery).length === 0);
    if (isAdmin || isPlainHealth) return;

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

    // Query-параметры и тело запроса (если переданы). Пароли маскируем.
    const hasQuery = reqQuery && Object.keys(reqQuery).length > 0;
    const hasBody = reqBody && typeof reqBody === 'object' && Object.keys(reqBody).length > 0;
    const safeBody = maskSensitive(reqBody);

    // Сообщение:
    // 1) requestId, accountId, метод url статус
    // 2) query-параметры (если есть)
    // 3) тело запроса (если есть)
    // 4) текст ошибки (если есть)
    const parts = [
      `requestId=${requestId} accountId=${accountId} | ${method} ${fullUrl} ${res.statusCode}`,
    ];
    if (hasQuery) parts.push(`params: ${JSON.stringify(reqQuery)}`);
    if (hasBody) parts.push(`body: ${JSON.stringify(safeBody)}`);
    if (errorText) parts.push(errorText);
    const message = parts.join('\n');

    const sqlQuery = records.map((r) => r.sql).join(';\n');
    const dbResponse = JSON.stringify(
      records.map((r) => ({ rowCount: r.rowCount, rows: r.rows })),
    );

    logToFile(level, message, {
      requestId,
      accountId,
      endpoint: fullUrl,
      method,
      duration,
      statusCode: res.statusCode,
      ip: req.ip || req.socket.remoteAddress,
      error: errorText || undefined,
      sql: sqlQuery,
    });

    logToDb(
      level,
      message,
      fullUrl,
      method,
      req.user?.userId,
      req.ip || req.socket.remoteAddress,
      { requestId, accountId, duration, statusCode: res.statusCode, query: reqQuery, body: safeBody },
      sqlQuery || undefined,
      dbResponse,
      errorHolder.stack,
    );
  });

  // Выполняем обработчик внутри контекстов: SQL-записи и stack ошибки
  errorStore.run(errorHolder, () => sqlStore.run(records, () => next()));
}
