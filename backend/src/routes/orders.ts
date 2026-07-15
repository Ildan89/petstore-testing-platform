import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/orders
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT o.*, p.name as pet_name, u.username
       FROM orders o
       JOIN pets p ON o.pet_id = p.id
       JOIN users u ON o.user_id = u.id
       ORDER BY o.placed_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders
router.post('/', async (req: Request, res: Response) => {
  try {
    const { pet_id, quantity = 1 } = req.body;

    if (!pet_id) {
      res.status(400).json({ error: 'pet_id обязателен' });
      return;
    }

    // BUG: race condition — не проверяем статус питомца в транзакции
    // BUG: можно заказать уже проданного питомца
    const pet = await pool.query('SELECT status FROM pets WHERE id = $1', [pet_id]);
    if (pet.rows.length === 0) {
      res.status(404).json({ error: 'Питомец не найден' });
      return;
    }

    // BUG: проверка статуса гонка — между проверкой и вставкой другой запрос может изменить статус
    if (pet.rows[0].status === 'sold') {
      res.status(400).json({ error: 'Питомец уже продан' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO orders (pet_id, user_id, quantity, status)
       VALUES ($1, $2, $3, 'placed') RETURNING *`,
      [pet_id, req.user!.userId, quantity]
    );

    // BUG: не обновляем статус питомца на pending
    // BUG: 200 вместо 201
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/orders/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      // BUG: любой пользователь может удалить любой заказ, не только свой
      'DELETE FROM orders WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      res.json({ error: 'Заказ не найден' });
      return;
    }

    res.json({ message: 'Заказ отменён' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
