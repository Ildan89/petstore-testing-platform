import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || 'pg4.sweb.ru',
  port: parseInt(process.env.PGPORT || '5433', 10),
  user: process.env.PGUSER || 'ramaldano2',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'ramaldano2',
  max: parseInt(process.env.PG_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
});

export default pool;
