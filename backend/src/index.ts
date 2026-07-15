import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { requestLogger } from './middleware/logger';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import petsRoutes from './routes/pets';
import ordersRoutes from './routes/orders';
import categoriesRoutes from './routes/categories';
import logsRoutes from './routes/logs';
import sqlRoutes from './routes/sql';
import dashboardRoutes from './routes/dashboard';

const app = express();
const PORT = process.env.PORT || 9000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/pets', petsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/sql', sqlRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(Number(PORT), HOST, () => {
  console.log(`Petstore API running on ${HOST}:${PORT}`);
});

export default app;
