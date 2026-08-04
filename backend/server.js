import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import products from './routes/products.js';
import transactions from './routes/transactions.js';
import payments from './routes/payments.js';
import admin from './routes/admin.js';
import support from './routes/support.js';
import manager from './routes/manager.js';
import notifications from './routes/notifications.js';
import account from './routes/account.js';

const app = express();
const backendDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(backendDir, '..');
const allowedOrigins = (process.env.APP_URL || '')
  .split(',')
  .map(value => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }
    return callback(Object.assign(new Error('مصدر الطلب غير مسموح'), { status: 403 }));
  }
}));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8' }));
app.use(express.json({
  limit: '1mb',
  verify(req, _res, buffer) {
    req.rawBody = buffer;
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api/products', products);
app.use('/api/transactions', transactions);
app.use('/api/payments', payments);
app.use('/api/admin', admin);
app.use('/api/support', support);
app.use('/api/manager', manager);
app.use('/api/notifications', notifications);
app.use('/api/account', account);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use(express.static(frontendRoot, { index: false }));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(frontendRoot, 'index.html'));
  }
  return next();
});

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = Number(err.status) || 500;
  res.status(status).json({
    error: status >= 500 ? 'حدث خطأ داخلي' : err.message,
    details: process.env.NODE_ENV === 'development' ? err.details || err.message : undefined
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Damanak http://localhost:${port}`));
