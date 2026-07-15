import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/auth';

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

    // BUG #14: сумма продаж считает ВСЕ заказы, включая отменённые (cancelled).
    // Должно быть: WHERE status != 'cancelled'
    const salesSum = await pool.query(
      `SELECT COALESCE(SUM(p.price * o.quantity), 0) AS total
       FROM orders o
       JOIN pets p ON o.pet_id = p.id
       WHERE o.seller_id = $1`,
      [sellerId]
    );

    res.json({
      pets: parseInt(petsCount.rows[0].count),
      orders: parseInt(ordersCount.rows[0].count),
      salesTotal: Number(salesSum.rows[0].total),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
