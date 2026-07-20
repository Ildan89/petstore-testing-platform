import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const STATUS_FLOW = ['placed', 'approved', 'delivered'];

// GET /api/orders — список заказов (фильтр по животному + пагинация)
router.get('/', async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const params: any[] = [];
    const isAdmin = req.user!.userId === 0;
    const sellerFilter = (req.query.seller_id as string) || '';

    let where: string;
    if (isAdmin) {
      // Admin видит все заказы, опционально фильтрует по продавцу
      where = ' WHERE 1=1';
      if (sellerFilter) {
        params.push(parseInt(sellerFilter, 10));
        where += ` AND o.seller_id = $${params.length}`;
      }
    } else {
      // BUG #1: показываем ВСЕ заказы продавцов, а не только заказы текущего продавца.
      // Должно быть: WHERE o.seller_id = req.user.userId.
      // Но заказы админа (seller_id = 0) скрыты от обычных продавцов.
      where = ' WHERE o.seller_id <> 0';
    }

    // Поиск по имени животного (рабочий)
    if (search) {
      params.push(`%${search}%`);
      where += ` AND p.name ILIKE $${params.length}`;
    }

    const listParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT o.id, o.pet_id, o.seller_id, o.buyer_name, o.buyer_phone,
              o.quantity, o.status, o.placed_at,
              p.name as pet_name, p.price as pet_price, u.username as seller_name
       FROM orders o
       JOIN pets p ON o.pet_id = p.id
       JOIN users u ON o.seller_id = u.id
       ${where}
       ORDER BY o.updated_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM orders');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders — оформление заказа
router.post('/', async (req: Request, res: Response) => {
  try {
    const { pet_id, buyer_name, buyer_phone } = req.body;

    if (!pet_id) {
      res.status(400).json({ error: 'pet_id обязателен' });
      return;
    }
    if (!buyer_name || !buyer_phone) {
      res.status(400).json({ error: 'Укажите покупателя: имя и телефон' });
      return;
    }
    if (typeof buyer_name === 'string' && buyer_name.length > 100) {
      res.status(400).json({ error: 'Имя покупателя не должно превышать 100 символов' });
      return;
    }
    if (typeof buyer_phone === 'string' && buyer_phone.length > 20) {
      res.status(400).json({ error: 'Телефон не должен превышать 20 символов' });
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

    // На питомца не должно быть других активных заказов (отменённые игнорируем)
    const existing = await pool.query(
      `SELECT id FROM orders WHERE pet_id = $1 AND status <> 'cancelled'`,
      [pet_id]
    );
    if (existing.rows.length > 0) {
      res.status(400).json({ error: 'На этого питомца уже есть активный заказ' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO orders (pet_id, seller_id, buyer_name, buyer_phone, quantity, status)
       VALUES ($1, $2, $3, $4, 1, 'placed') RETURNING *`,
      [pet_id, req.user!.userId, buyer_name, buyer_phone]
    );

    // После оформления животное становится проданным
    await pool.query(`UPDATE pets SET status = 'sold' WHERE id = $1`, [pet_id]);

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    // 23505 = unique_violation: сработал частичный уникальный индекс
    // uniq_active_order_per_pet (гонка double-submit — второй заказ отклонён БД).
    if (err.code === '23505') {
      res.status(400).json({ error: 'На этого питомца уже есть активный заказ' });
      return;
    }
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
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
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
