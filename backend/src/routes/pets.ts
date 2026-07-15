import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/pets — список с поиском и пагинацией
router.get('/', async (req: Request, res: Response) => {
  try {
    // BUG: search передаётся напрямую в SQL без экранирования → SQL-инъекция
    const search = req.query.search as string || '';
    const status = req.query.status as string || '';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sort = req.query.sort as string || 'id';

    // BUG: sort не валидируется → можно передать любое поле
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.id, p.name, p.category_id, c.name as category_name,
             p.status, p.price, p.description, p.created_at, p.updated_at
      FROM pets p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (search) {
      // BUG: SQL-инъекция через search
      query += ` AND (p.name ILIKE '%${search}%' OR p.description ILIKE '%${search}%')`;
    }

    if (status) {
      params.push(status);
      query += ` AND p.status = $${params.length}`;
    }

    // Фильтр по категории (рабочий, параметризованный)
    const categoryId = req.query.category_id as string || '';
    if (categoryId) {
      params.push(parseInt(categoryId, 10));
      query += ` AND p.category_id = $${params.length}`;
    }

    // BUG: сортировка без проверки поля
    query += ` ORDER BY ${sort} ASC`;

    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    // BUG: пагинация не учитывает фильтры в count
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
    // BUG: утечка деталей ошибки
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pets/:id — один питомец
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.id, p.name, p.category_id, c.name as category_name,
              p.status, p.price, p.description, p.created_at, p.updated_at
       FROM pets p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      // BUG: 200 вместо 404
      res.json({ error: 'Питомец не найден' });
      return;
    }

    // BUG: id возвращается как число (BigInt теряет точность в JSON)
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pets — создание
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, category_id, status, price, description } = req.body;

    // BUG: нет проверки на отрицательную цену
    if (!name) {
      res.status(400).json({ error: 'name обязателен' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO pets (name, category_id, status, price, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, category_id, status || 'available', price, description]
    );

    // BUG: 200 вместо 201
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pets/:id — обновление
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category_id, status, price, description } = req.body;

    // BUG: не проверяем, что питомец существует
    // BUG: можно установить отрицательную цену
    const result = await pool.query(
      `UPDATE pets SET
        name = COALESCE($1, name),
        category_id = COALESCE($2, category_id),
        status = COALESCE($3, status),
        price = COALESCE($4, price),
        description = COALESCE($5, description),
        updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, category_id, status, price, description, id]
    );

    if (result.rows.length === 0) {
      // BUG: снова 200 вместо 404
      res.json({ error: 'Питомец не найден' });
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
    const { id } = req.params;

    // BUG: нет проверки связанных заказов — удаляем питомца с активными заказами
    const result = await pool.query('DELETE FROM pets WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      // BUG: 200 вместо 404
      res.json({ error: 'Питомец не найден' });
      return;
    }

    // BUG: 200 вместо 204
    res.json({ message: 'Удалён', pet: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
