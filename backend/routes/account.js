import { Router } from 'express';
import { admin } from '../utils/supabase.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

const PROFILE_FIELDS = [
  'full_name', 'phone', 'display_name', 'store_name', 'store_description',
  'city', 'support_email', 'avatar_url', 'store_logo_url', 'store_cover_url'
];

router.get('/', (req, res) => res.json(req.user.profile));

router.get('/overview', async (req, res) => {
  const userId = req.user.id;
  const [buyerResult, sellerResult, productsResult, notificationsResult] = await Promise.all([
    admin.from('transactions').select('*,product:products(title,image_url)').eq('buyer_id', userId).order('created_at', { ascending: false }),
    admin.from('transactions').select('*,product:products(title,image_url)').eq('seller_id', userId).order('created_at', { ascending: false }),
    admin.from('products').select('*').eq('seller_id', userId).order('created_at', { ascending: false }),
    admin.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
  ]);

  const failure = [buyerResult, sellerResult, productsResult, notificationsResult].find(result => result.error);
  if (failure?.error) throw failure.error;

  const sellerTransactions = sellerResult.data || [];
  const completedSales = sellerTransactions.filter(item => item.status === 'completed');
  const pendingBalance = sellerTransactions
    .filter(item => ['funds_held', 'shipped'].includes(item.status))
    .reduce((sum, item) => sum + Number(item.amount || 0) - Number(item.commission || 0), 0);
  const availableBalance = completedSales
    .reduce((sum, item) => sum + Number(item.amount || 0) - Number(item.commission || 0), 0);

  res.json({
    profile: req.user.profile,
    buyer: { transactions: buyerResult.data || [] },
    seller: {
      transactions: sellerTransactions,
      products: productsResult.data || [],
      completed_sales: completedSales.length,
      pending_balance: pendingBalance,
      available_balance: availableBalance
    },
    notifications: notificationsResult.data || []
  });
});

router.put('/', async (req, res) => {
  const payload = {};
  for (const field of PROFILE_FIELDS) {
    if (req.body[field] !== undefined) payload[field] = String(req.body[field] || '').trim().slice(0, 500);
  }
  if (!Object.keys(payload).length) return res.status(422).json({ error: 'ما فيه بيانات صالحة للحفظ' });
  payload.updated_at = new Date().toISOString();
  const { data, error } = await admin.from('profiles').update(payload).eq('id', req.user.id).select().single();
  if (error) throw error;
  res.json(data);
});

router.put('/mode', async (req, res) => {
  const activeMode = req.body.active_mode;
  if (!['buyer', 'seller'].includes(activeMode)) return res.status(422).json({ error: 'وضع الحساب غير صالح' });
  const { data, error } = await admin.from('profiles').update({ active_mode: activeMode }).eq('id', req.user.id).select().single();
  if (error) throw error;
  res.json({ active_mode: data.active_mode });
});

router.post('/tickets', async (req, res) => {
  const { data, error } = await admin.from('support_tickets').insert({
    user_id: req.user.id,
    subject: String(req.body.subject || '').trim().slice(0, 160),
    message: String(req.body.message || '').trim().slice(0, 3000)
  }).select().single();
  if (error) throw error;
  res.status(201).json(data);
});

export default router;
