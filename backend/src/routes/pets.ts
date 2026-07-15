import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/pets — список с поиском, фильтрами и пагинацией
router.get('/', async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const categoryId = (req.query.category_id as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;
    const offset = (page - 1) * limit;

    const params: any[] = [];

    // BUG #16: показываем свои + "ничейные" (seller_id IS NULL) — чужие без владельца
    // видны всем продавцам. Должно быть: только свои.
    params.push(sellerId);
    let where = ` WHERE (p.seller_id = $${params.length} OR p.seller_id IS NULL)`;

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }
    if (status) {
      params.push(status);
      where += ` AND p.status = $${params.length}`;
    }
    if (categoryId) {
      params.push(parseInt(categoryId, 10));
      where += ` AND p.category_id = $${params.length}`;
    }

    const listParams = [...params];
    listParams.push(limit);
    listParams.push(offset);

    const query = `
      SELECT p.id, p.name, p.category_id, c.name as category_name,
             p.status, p.price, p.description, p.seller_id,
             p.created_at, p.updated_at
      FROM pets p
      LEFT JOIN categories c ON p.category_id = c.id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
    `;
    const result = await pool.query(query, listParams);

    // BUG #7: total считается БЕЗ учёта фильтров (общий COUNT) — пагинация врёт
    const countResult = await pool.query('SELECT COUNT(*) FROM pets');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pets/:id — один питомец
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.category_id, c.name as category_name,
              p.status, p.price, p.description, p.seller_id,
              p.created_at, p.updated_at
       FROM pets p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Питомец не найден' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pets — создание
router.post('/', async (req: Request, res: Response) => {
  try {
    // BUG #10: плавающая 500 (~30%) — "не удалось подключиться к БД".
    // Питомец не создаётся. Нестабильно. Пишется в логи (через requestLogger).
    if (Math.random() < 0.3) {
      res.status(500).json({ error: 'Не удалось подключиться к базе данных' });
      return;
    }

    const { name, category_id, status, description } = req.body;
    let { price } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name обязателен' });
      return;
    }

    // BUG #2: расхождение запрос/ответ — цену тихо режем /10 (1000 -> 100)
    if (price !== undefined && price !== null) {
      price = Number(price) / 10;
    }

    // BUG #15: NULL в category_id/seller_id/status проходит (не валидируем).
    // BUG #6: отрицательная цена проходит (CHECK снят на уровне БД).
    // BUG #13: seller_id берём из тела, если передан (mass assignment),
    // иначе — текущий пользователь.
    const sellerId =
      req.body.seller_id !== undefined ? req.body.seller_id : req.user!.userId;

    // status: если поле не передано вовсе — 'available'; если передан null — оставляем null (BUG #15)
    const statusValue = 'status' in req.body ? status : 'available';

    const result = await pool.query(
      `INSERT INTO pets (name, category_id, status, price, description, seller_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, category_id, statusValue, price, description, sellerId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pets/:id — обновление
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, category_id, status, description } = req.body;
    let { price } = req.body;

    // BUG #2: та же подмена цены при обновлении
    if (price !== undefined && price !== null) {
      price = Number(price) / 10;
    }

    // BUG #13: seller_id можно переназначить через тело запроса (mass assignment)
    const result = await pool.query(
      `UPDATE pets SET
        name = COALESCE($1, name),
        category_id = COALESCE($2, category_id),
        status = COALESCE($3, status),
        price = COALESCE($4, price),
        description = COALESCE($5, description),
        seller_id = COALESCE($6, seller_id),
        updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [name, category_id, status, price, description, req.body.seller_id ?? null, req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Питомец не найден' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pets/:id — удаление
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // BUG #9: нет проверки активных заказов — удаляем даже с заказом.
    // BUG: удаляем связанные заказы, чтобы не падал FK (заодно теряем историю).
    await pool.query('DELETE FROM orders WHERE pet_id = $1', [req.params.id]);

    // BUG #10 (delete): нет проверки статуса — проданное животное тоже удаляется.
    const result = await pool.query('DELETE FROM pets WHERE id = $1 RETURNING *', [
      req.params.id,
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Питомец не найден' });
      return;
    }
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
