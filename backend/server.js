import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// استدعاء ملفات الـ Routes
import authRoutes from './routes/auth.js';
import products from './routes/products.js';
import transactions from './routes/transactions.js';
import payments from './routes/payments.js';
import adminRoutes from './routes/admin.js';
import support from './routes/support.js';
import manager from './routes/manager.js';
import notifications from './routes/notifications.js';
import account from './routes/account.js';

// عميل Supabase
import { admin } from './utils/supabase.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

// النطاقات المسموح لها بالاتصال بالباك إند
const defaultAllowedOrigins = [
  'https://yoseff33.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5500'
];

// يسمح بإضافة نطاقات أخرى من متغير APP_URL في Render
const environmentOrigins = (process.env.APP_URL || '')
  .split(',')
  .map(value => value.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = new Set([
  ...defaultAllowedOrigins,
  ...environmentOrigins
]);

const corsOptions = {
  origin(origin, callback) {
    // السماح للطلبات التي ما تحتوي Origin،
    // مثل Render Health Check وPostman والطلبات الداخلية
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, '');

    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked origin: ${origin}`);

    return callback(
      Object.assign(new Error('هذا النطاق غير مسموح له بالاتصال بالخادم'), {
        status: 403
      })
    );
  },

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept'
  ],

  exposedHeaders: [
    'RateLimit',
    'RateLimit-Policy',
    'RateLimit-Remaining',
    'RateLimit-Reset'
  ],

  credentials: false,
  optionsSuccessStatus: 204,
  maxAge: 86400
};

app.set('trust proxy', 1);

// يجب وضع CORS قبل المسارات والحماية ومحدد الطلبات
app.use(cors(corsOptions));

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false
  })
);

app.use(
  express.json({
    limit: '1mb',

    verify(req, _res, buffer) {
      req.rawBody = buffer;
    }
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '1mb'
  })
);

// فحص حالة الباك إند
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'damanak-backend',
    timestamp: new Date().toISOString()
  });
});

// إعداد مسارات API
app.use('/api/auth', authRoutes);
app.use('/api/products', products);
app.use('/api/transactions', transactions);
app.use('/api/payments', payments);
app.use('/api/admin', adminRoutes);
app.use('/api/support', support);
app.use('/api/manager', manager);
app.use('/api/notifications', notifications);
app.use('/api/account', account);

// معالجة مسارات API غير الموجودة
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'مسار API المطلوب غير موجود'
  });
});

// خدمة ملفات الواجهة
app.use(
  express.static(frontendRoot, {
    index: false
  })
);

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(frontendRoot, 'index.html'));
  }

  return next();
});

// معالجة الأخطاء
app.use((err, req, res, _next) => {
  console.error('Request error:', {
    method: req.method,
    path: req.path,
    origin: req.headers.origin,
    message: err.message,
    stack: process.env.NODE_ENV === 'development'
      ? err.stack
      : undefined
  });

  const status = Number(err.status) || 500;

  res.status(status).json({
    error: status >= 500
      ? 'حدث خطأ داخلي في الخادم'
      : err.message,

    details: process.env.NODE_ENV === 'development'
      ? err.details || err.message
      : undefined
  });
});

const port = Number(process.env.PORT || 3000);

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Damanak server running on port ${port}`);

  // فحص اتصال Supabase
  admin
    .from('products')
    .select('count', {
      count: 'exact',
      head: true
    })
    .then(({ error }) => {
      if (error) {
        console.error(
          '❌ Supabase connection failed:',
          error.message
        );
      } else {
        console.log('✅ Supabase connected successfully!');
      }
    })
    .catch(error => {
      console.error(
        '❌ Supabase test error:',
        error.message
      );
    });
});

// إغلاق الخادم بشكل آمن
function shutdown(signal) {
  console.log(`${signal} received, shutting down server`);

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// تسجيل الأخطاء غير المعالجة
process.on('unhandledRejection', reason => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', error => {
  console.error('❌ Uncaught Exception:', error);
});
