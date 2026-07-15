import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const STATUS_FLOW = ['placed', 'approved', 'delivered'];

// GET /api/orders — список заказов
router.get('/', async (req: Request, res: Response) => {
  try {
    // BUG #1: показываем ВСЕ заказы, а не только заказы текущего продавца.
    // Должно быть: WHERE o.seller_id = req.user.userId
    const result = await pool.query(
      `SELECT o.id, o.pet_id, o.seller_id, o.buyer_name, o.buyer_phone,
              o.quantity, o.status, o.placed_at,
              p.name as pet_name, p.price as pet_price, u.username as seller_name
       FROM orders o
       JOIN pets p ON o.pet_id = p.id
       JOIN users u ON o.seller_id = u.id
       ORDER BY o.placed_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders — оформление заказа
router.post('/', async (req: Request, res: Response) => {
  try {
    const { pet_id, quantity = 1, buyer_name, buyer_phone } = req.body;

    if (!pet_id) {
      res.status(400).json({ error: 'pet_id обязателен' });
      return;
    }
    if (!buyer_name || !buyer_phone) {
      res.status(400).json({ error: 'Укажите покупателя: имя и телефон' });
      return;
    }
    if (quantity < 1) {
      res.status(400).json({ error: 'Количество должно быть не менее 1' });
      return;
    }

    // BUG #4: проверка статуса и вставка — вне транзакции/без блокировки.
    // Между SELECT и INSERT статус может измениться → можно заказать проданного (race).
    const pet = await pool.query('SELECT status FROM pets WHERE id = $1', [pet_id]);
    if (pet.rows.length === 0) {
      res.status(404).json({ error: 'Питомец не найден' });
      return;
    }
    if (pet.rows[0].status === 'sold') {
      res.status(400).json({ error: 'Питомец уже продан' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO orders (pet_id, seller_id, buyer_name, buyer_phone, quantity, status)
       VALUES ($1, $2, $3, $4, $5, 'placed') RETURNING *`,
      [pet_id, req.user!.userId, buyer_name, buyer_phone, quantity]
    );

    // После оформления животное становится проданным
    await pool.query(`UPDATE pets SET status = 'sold' WHERE id = $1`, [pet_id]);

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/orders/:id/status — смена статуса
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!STATUS_FLOW.includes(status) && status !== 'cancelled') {
      res.status(400).json({ error: 'Недопустимый статус' });
      return;
    }

    const result = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }

    // Отмена → животное снова доступно
    if (status === 'cancelled') {
      await pool.query(`UPDATE pets SET status = 'available' WHERE id = $1`, [
        result.rows[0].pet_id,
      ]);
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/orders/:id — отмена (удаление) заказа
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const order = await pool.query('SELECT pet_id FROM orders WHERE id = $1', [
      req.params.id,
    ]);
    const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }
    // Возвращаем животное в продажу
    if (order.rows.length > 0) {
      await pool.query(`UPDATE pets SET status = 'available' WHERE id = $1`, [
        order.rows[0].pet_id,
      ]);
    }
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
