require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// استدعاء ملفات الـ Routes
const authRoutes = require('./routes/auth');
const products = require('./routes/products');
const transactions = require('./routes/transactions');
const payments = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const support = require('./routes/support');
const manager = require('./routes/manager');
const notifications = require('./routes/notifications');
const account = require('./routes/account');

// استدعاء عميل Supabase للتحقق من الاتصال عند التشغيل
const { admin } = require('./utils/supabase');

const app = express();
const frontendRoot = path.resolve(__dirname, '..');

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

// إعداد المسارات API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', products);
app.use('/api/transactions', transactions);
app.use('/api/payments', payments);
app.use('/api/admin', adminRoutes);
app.use('/api/support', support);
app.use('/api/manager', manager);
app.use('/api/notifications', notifications);
app.use('/api/account', account);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// خدمة الملفات الثابتة والفرونت إند
app.use(express.static(frontendRoot, { index: false }));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(frontendRoot, 'index.html'));
  }
  return next();
});

// معالجة الأخطاء
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = Number(err.status) || 500;
  res.status(status).json({
    error: status >= 500 ? 'حدث خطأ داخلي' : err.message,
    details: process.env.NODE_ENV === 'development' ? err.details || err.message : undefined
  });
});

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Damanak server running on http://localhost:${port}`);
  
  // فحص الاتصال بقواعد بيانات Supabase فور تشغيل السيرفر
  admin.from('products').select('count', { count: 'exact', head: true })
    .then(({ error }) => {
      if (error) {
        console.error('❌ Supabase connection failed:', error.message);
      } else {
        console.log('✅ Supabase connected successfully!');
      }
    })
    .catch(err => console.error('❌ Supabase test error:', err.message));
});
