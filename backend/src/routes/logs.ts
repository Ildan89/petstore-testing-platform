import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/logs — логи из БД с фильтрами и пагинацией
router.get('/', async (req: Request, res: Response) => {
  try {
    const level = req.query.level as string;
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;
    const search = req.query.search as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const params: any[] = [];
    let where = ' WHERE 1=1';

    if (level) {
      params.push(level);
      where += ` AND level = $${params.length}`;
    }
    if (dateFrom) {
      params.push(dateFrom);
      where += ` AND created_at >= $${params.length}`;
    }
    if (dateTo) {
      params.push(dateTo);
      where += ` AND created_at <= $${params.length}`;
    }
    if (search) {
      // Общий поиск: по сообщению, SQL-запросу, ответу БД и stack trace
      params.push(`%${search}%`);
      const p = params.length;
      where += ` AND (message ILIKE $${p} OR sql_query ILIKE $${p} OR db_response ILIKE $${p} OR stack ILIKE $${p})`;
    }

    const listParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT * FROM logs ${where}
       ORDER BY updated_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM logs ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      count: result.rows.length,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
