import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const router = Router();
router.use(authMiddleware);

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// GET /api/logs — поиск по логам
router.get('/', async (req: Request, res: Response) => {
  try {
    const level = req.query.level as string;
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;
    const search = req.query.search as string;
    const source = req.query.source as string || 'db'; // 'db' или 'file'

    if (source === 'file') {
      // Поиск по файловым логам
      const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.log')).sort().reverse();
      let results: string[] = [];

      for (const file of files.slice(0, 7)) { // последние 7 дней
        const content = fs.readFileSync(path.join(LOG_DIR, file), 'utf-8');
        const lines = content.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (level && parsed.level !== level) continue;
            // BUG: поиск чувствителен к регистру в файловых логах
            if (search && !parsed.message?.includes(search)) continue;
            if (dateFrom && parsed.timestamp < dateFrom) continue;
            if (dateTo && parsed.timestamp > dateTo) continue;
            results.push(parsed);
          } catch {}
        }
      }

      // BUG: нет пагинации для файловых логов
      res.json({ source: 'file', count: results.length, data: results.slice(0, 100) });
    } else {
      // Поиск по БД
      let query = 'SELECT * FROM logs WHERE 1=1';
      const params: any[] = [];
      let paramIdx = 0;

      if (level) {
        paramIdx++;
        query += ` AND level = $${paramIdx}`;
        params.push(level);
      }

      if (dateFrom) {
        paramIdx++;
        query += ` AND created_at >= $${paramIdx}`;
        params.push(dateFrom);
      }

      if (dateTo) {
        paramIdx++;
        query += ` AND created_at <= $${paramIdx}`;
        params.push(dateTo);
      }

      if (search) {
        paramIdx++;
        // BUG: поиск в БД регистронезависимый, а в файлах — регистрозависимый
        query += ` AND message ILIKE $${paramIdx}`;
        params.push(`%${search}%`);
      }

      query += ' ORDER BY created_at DESC LIMIT 100';

      const result = await pool.query(query, params);
      res.json({ source: 'db', count: result.rows.length, data: result.rows });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
