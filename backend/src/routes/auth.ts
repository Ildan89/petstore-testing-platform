import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db';
import { generateToken, authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, confirm_password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'username и password обязательны' });
      return;
    }

    // Защита настоящего админа (Admin, id=0): не даём зарегистрироваться на этот логин
    // и не раскрываем, что он существует.
    if (username === 'Admin') {
      res.status(401).json({ error: 'Неверный логин или пароль' });
      return;
    }

    // Пароли должны совпадать (требование)
    if (confirm_password !== undefined && password !== confirm_password) {
      res.status(400).json({ error: 'Пароли не совпадают' });
      return;
    }

    if (password.length < 3) {
      res.status(400).json({ error: 'Пароль должен быть не менее 3 символов' });
      return;
    }

    const hash = await bcrypt.hash(password, 10);

    // BUG #17: повторная регистрация на существующий username не даёт ошибку.
    // Старого пользователя переименовываем (освобождаем имя) и заводим НОВОГО с новым id.
    // Животные/заказы прежнего продавца остаются висеть на старом id — становятся "осиротевшими".
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      const oldId = existing.rows[0].id;
      await pool.query(
        'UPDATE users SET username = $1 WHERE id = $2',
        [`${username}_old_${oldId}`, oldId]
      );
    }

    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
      [username, hash]
    );

    const token = generateToken({ userId: result.rows[0].id, username });

    res.status(201).json({
      id: result.rows[0].id,
      username,
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'username и password обязательны' });
      return;
    }

    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    // Единое сообщение (не раскрываем, существует ли пользователь)
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Неверный логин или пароль' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Неверный логин или пароль' });
      return;
    }

    const token = generateToken({ userId: user.id, username: user.username });

    res.json({
      id: user.id,
      username: user.username,
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    // BUG #11: утечка password_hash в ответе профиля
    const result = await pool.query(
      'SELECT id, username, password_hash, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;
