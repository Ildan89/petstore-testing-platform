import { Request, Response, NextFunction } from 'express';
import pool from '../db';
import fs from 'fs';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// Ensure log directory exists
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}

export function logToFile(level: string, message: string, meta?: Record<string, unknown>): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  }) + '\n';
  const date = new Date().toISOString().slice(0, 10);
  fs.appendFileSync(path.join(LOG_DIR, `app-${date}.log`), line);
}

export async function logToDb(
  level: string,
  message: string,
  endpoint?: string,
  method?: string,
  userId?: number,
  ip?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO logs (level, message, endpoint, method, user_id, ip, details) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [level, message, endpoint, method, userId, ip, details ? JSON.stringify(details) : null]
    );
  } catch {
    // Silently fail — logging shouldn't break the app
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const meta = {
      endpoint: req.path,
      method: req.method,
      duration,
      statusCode: res.statusCode,
      ip: req.ip || req.socket.remoteAddress,
      userId: req.user?.userId,
    };

    logToFile(
      res.statusCode >= 400 ? 'ERROR' : 'INFO',
      `${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
      meta
    );

    logToDb(
      res.statusCode >= 400 ? 'ERROR' : 'INFO',
      `${req.method} ${req.path} ${res.statusCode}`,
      req.path,
      req.method,
      req.user?.userId,
      req.ip || req.socket.remoteAddress,
      { duration, statusCode: res.statusCode, query: req.query, body: req.body }
    );
  });

  next();
}
