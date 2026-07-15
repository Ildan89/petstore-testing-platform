import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Запрещённые ключевые слова (только SELECT и JOIN)
const FORBIDDEN = [
  /insert\b/i, /update\b/i, /delete\b/i, /drop\b/i, /alter\b/i,
  /create\b/i, /truncate\b/i, /grant\b/i, /revoke\b/i, /vacuum\b/i,
  /reindex\b/i, /discard\b/i, /copy\b/i, /execute\b/i, /call\b/i,
  /pg_sleep/i, /pg_read_file/i, /pg_read_binary_file/i,
  /pg_stat_file/i, /pg_ls_dir/i, /lo_import/i, /lo_export/i,
  /pg_terminate_backend/i, /pg_cancel_backend/i,
];

// Разрешённые схемы
const ALLOWED_SCHEMAS = ['public'];

function validateQuery(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim();

  // Только SELECT или CTE (WITH ... SELECT). Модификации отсекаются списком FORBIDDEN ниже.
  if (!/^\s*(select|with)\b/i.test(trimmed)) {
    return { valid: false, error: 'Разрешены только SELECT-запросы' };
  }

  // Проверка на запрещённые слова
  for (const pattern of FORBIDDEN) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: `Запрещённая операция: ${pattern.source}` };
    }
  }

  // Проверка на обращение к системным схемам
  if (/\b(pg_catalog|information_schema|pg_temp)\b/i.test(trimmed)) {
    return { valid: false, error: 'Доступ к системным таблицам запрещён' };
  }

  return { valid: true };
}

// POST /api/sql/execute
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Поле query обязательно' });
      return;
    }

    const validation = validateQuery(query);
    if (!validation.valid) {
      res.status(403).json({ error: validation.error });
      return;
    }

    // BUG: не ограничиваем количество возвращаемых строк
    const result = await pool.query(query);

    // BUG: показываем структуру таблицы в ошибке
    res.json({
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(f => ({ name: f.name, dataTypeID: f.dataTypeID })),
    });
  } catch (err: any) {
    // BUG: утечка структуры БД через ошибки
    res.status(400).json({
      error: err.message,
      detail: err.detail,
      hint: err.hint,
      // BUG: раскрываем информацию о схеме
    });
  }
});

export default router;
