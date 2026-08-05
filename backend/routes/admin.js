import { Router } from 'express';
import { admin } from '../utils/supabase.js';
import { auth } from '../middleware/auth.js';
import { roleCheck } from '../middleware/roleCheck.js';

const router = Router();
router.use(auth, roleCheck('admin'));

router.get('/overview', async (_req, res) => {
  const [users, products, transactions, disputes, alerts] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('products').select('*', { count: 'exact', head: true }),
    admin.from('transactions').select('amount,commission,status'),
    admin.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    admin.from('fraud_alerts').select('*', { count: 'exact', head: true })
  ]);
  const failed = [users, products, transactions, disputes, alerts].find(item => item.error);
  if (failed?.error) throw failed.error;
  const rows = transactions.data || [];
  res.json({
    users: users.count || 0,
    products: products.count || 0,
    transactions: rows.length,
    open_disputes: disputes.count || 0,
    fraud_alerts: alerts.count || 0,
    held_amount: rows.filter(x => ['funds_held', 'shipped'].includes(x.status)).reduce((sum, x) => sum + Number(x.amount || 0), 0),
    commissions: rows.filter(x => x.status === 'completed').reduce((sum, x) => sum + Number(x.commission || 0), 0)
  });
});

router.get('/transactions', async (_req, res) => {
  const { data, error } = await admin.from('transactions').select('*,product:products(title),buyer:profiles!transactions_buyer_id_fkey(full_name),seller:profiles!transactions_seller_id_fkey(full_name)').order('created_at', { ascending: false });
  if (error) throw error;
  res.json(data);
});
router.get('/users', async (_req, res) => {
  const { data, error } = await admin.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  res.json(data);
});
router.put('/users/:id/verify', async (req, res) => {
  const { data, error } = await admin.from('profiles').update({ nafath_verified: !!req.body.verified }).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(data);
});
router.get('/fraud-alerts', async (_req, res) => {
  const { data, error } = await admin.from('fraud_alerts').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  res.json(data);
});
router.put('/transactions/:id/resolve-dispute', async (req, res) => {
  const { beneficiary, notes } = req.body;
  if (!['buyer', 'seller'].includes(beneficiary)) return res.status(422).json({ error: 'حدد المستفيد' });
  const { data: transaction } = await admin.from('transactions').select('*').eq('id', req.params.id).single();
  await admin.from('disputes').update({ status: 'resolved', resolved_by: req.user.id, admin_notes: notes, resolution: beneficiary }).eq('transaction_id', transaction.id).eq('status', 'open');
  await admin.from('transactions').update({ status: beneficiary === 'seller' ? 'completed' : 'cancelled' }).eq('id', transaction.id);
  res.json({ resolved: true });
});
router.put('/settings/commission', async (req, res) => {
  const rate = Number(req.body.rate);
  if (rate < 0 || rate > 0.2) return res.status(422).json({ error: 'نسبة غير صالحة' });
  const { data, error } = await admin.from('platform_settings').upsert({ key: 'commission_rate', value: rate }).select().single();
  if (error) throw error;
  res.json(data);
});

export default router;
