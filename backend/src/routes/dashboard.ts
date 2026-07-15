import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/auth';
import { logToDb } from '../middleware/logger';

const router = Router();
router.use(authMiddleware);

// GET /api/dashboard — счётчики продавца
router.get('/', async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;

    // Кол-во животных (свои + ничейные — как в списке питомцев)
    const petsCount = await pool.query(
      'SELECT COUNT(*) FROM pets WHERE seller_id = $1 OR seller_id IS NULL',
      [sellerId]
    );

    // Кол-во заказов продавца
    const ordersCount = await pool.query(
      'SELECT COUNT(*) FROM orders WHERE seller_id = $1',
      [sellerId]
    );

    // BUG #18 (уровень БД): обращение к несуществующей колонке o.total_amount.
    // PostgreSQL вернёт "column o.total_amount does not exist" → эндпоинт падает с 500.
    // Причина видна в логах (sql_query + текст ошибки БД).
    const salesSum = await pool.query(
      `SELECT COALESCE(SUM(o.total_amount), 0) AS total
       FROM orders o
       WHERE o.seller_id = $1`,
      [sellerId]
    );

    res.json({
      pets: parseInt(petsCount.rows[0].count),
      orders: parseInt(ordersCount.rows[0].count),
      salesTotal: Number(salesSum.rows[0].total),
    });
  } catch (err: any) {
    // Реальную причину (ошибка БД + SQL) пишем ТОЛЬКО в логи.
    // Наружу отдаём generic-сообщение — кандидат ищет причину в логах.
    await logToDb(
      'ERROR',
      `Ошибка БД в /dashboard: ${err.message}`,
      '/api/dashboard',
      'GET',
      req.user?.userId,
      req.ip,
      { code: err.code, detail: err.detail },
      err.query || 'SELECT COALESCE(SUM(o.total_amount), 0) AS total FROM orders o WHERE o.seller_id = $1',
      err.message,
    );
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
