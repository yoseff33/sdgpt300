import { Router } from 'express';
import { admin } from '../utils/supabase.js';
import { auth } from '../middleware/auth.js';
import { roleCheck } from '../middleware/roleCheck.js';

const router = Router();
router.use(auth, roleCheck('admin'));

// حماية دالة التدقيق حتى ما تطيّح العمليات الأساسية إذا فشلت
const audit = async (req, action, targetType, targetId, details = {}) => {
  try {
    await admin.from('admin_audit_logs').insert({
      admin_id: req.user.id, 
      action, 
      target_type: targetType, 
      target_id: String(targetId || ''),
      details, 
      ip_address: req.ip
    });
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
};

const riskLevel = score => score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';

router.get('/overview', async (_req, res) => {
  try {
    const [users, products, transactions, disputes, alerts] = await Promise.all([
      admin.from('profiles').select('account_status,risk_level'),
      admin.from('products').select('moderation_status'),
      admin.from('transactions').select('amount,commission,status,created_at'),
      admin.from('disputes').select('status'),
      admin.from('fraud_alerts').select('id')
    ]);

    const failed = [users, products, transactions, disputes, alerts].find(item => item.error);
    if (failed?.error) return res.status(500).json({ error: failed.error.message });

    const tx = transactions.data || [], userRows = users.data || [], productRows = products.data || [];
    res.json({
      users: userRows.length, 
      active_users: userRows.filter(x => x.account_status === 'active').length,
      blocked_users: userRows.filter(x => ['suspended','banned'].includes(x.account_status)).length,
      high_risk_users: userRows.filter(x => ['high','critical'].includes(x.risk_level)).length,
      products: productRows.length, 
      suspended_products: productRows.filter(x => ['suspended','rejected'].includes(x.moderation_status)).length,
      transactions: tx.length, 
      open_disputes: (disputes.data || []).filter(x => x.status === 'open').length,
      fraud_alerts: (alerts.data || []).length,
      held_amount: tx.filter(x => ['funds_held','shipped'].includes(x.status)).reduce((s,x) => s + Number(x.amount || 0), 0),
      sales_volume: tx.filter(x => x.status === 'completed').reduce((s,x) => s + Number(x.amount || 0), 0),
      commissions: tx.filter(x => x.status === 'completed').reduce((s,x) => s + Number(x.commission || 0), 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    let query = admin.from('profiles').select('*').order('created_at', { ascending: false });
    if (req.query.status) query = query.eq('account_status', req.query.status);
    if (req.query.risk) query = query.eq('risk_level', req.query.risk);
    if (req.query.q) {
      const cleanQ = String(req.query.q).replace(/[%_]/g, '').slice(0, 80);
      query = query.or(`full_name.ilike.%${cleanQ}%,phone.ilike.%${cleanQ}%`);
    }
    const { data, error } = await query.limit(500);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const [profile, purchases, sales, products, alerts] = await Promise.all([
      admin.from('profiles').select('*').eq('id', userId).single(),
      admin.from('transactions').select('*,product:products(title)').eq('buyer_id', userId).order('created_at', { ascending: false }),
      admin.from('transactions').select('*,product:products(title)').eq('seller_id', userId).order('created_at', { ascending: false }),
      admin.from('products').select('*').eq('seller_id', userId).order('created_at', { ascending: false }),
      admin.from('fraud_alerts').select('*').order('created_at', { ascending: false })
    ]);
    if (profile.error) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const transactionIds = [...(purchases.data || []), ...(sales.data || [])].map(x => x.id);
    res.json({ 
      profile: profile.data, 
      purchases: purchases.data || [], 
      sales: sales.data || [], 
      products: products.data || [], 
      alerts: (alerts.data || []).filter(x => transactionIds.includes(x.transaction_id)) 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const targetId = req.params.id;
    const allowedRoles = ['user','buyer','seller','support','manager','admin'];
    const allowedStatuses = ['active','suspended','banned'];
    const payload = {};
    if (req.body.full_name !== undefined) payload.full_name = String(req.body.full_name).trim().slice(0,120);
    if (req.body.admin_notes !== undefined) payload.admin_notes = String(req.body.admin_notes).trim().slice(0,2000);
    if (req.body.nafath_verified !== undefined) payload.nafath_verified = !!req.body.nafath_verified;
    if (req.body.role !== undefined) {
      if (!allowedRoles.includes(req.body.role)) return res.status(422).json({ error: 'الدور غير صالح' });
      if (targetId === req.user.id && req.body.role !== 'admin') return res.status(409).json({ error: 'ما تقدر تسحب صلاحية الأدمن من حسابك الحالي' });
      payload.role = req.body.role;
    }
    if (req.body.account_status !== undefined) {
      if (!allowedStatuses.includes(req.body.account_status)) return res.status(422).json({ error: 'حالة الحساب غير صالحة' });
      if (targetId === req.user.id && req.body.account_status !== 'active') return res.status(409).json({ error: 'ما تقدر تحظر أو تعلّق حسابك الحالي' });
      payload.account_status = req.body.account_status;
      payload.suspension_reason = req.body.account_status === 'active' ? null : String(req.body.suspension_reason || '').trim().slice(0,500);
      payload.suspended_until = req.body.account_status === 'suspended' && req.body.suspended_until ? new Date(req.body.suspended_until).toISOString() : null;
    }
    payload.updated_at = new Date().toISOString();
    const { data, error } = await admin.from('profiles').update(payload).eq('id', targetId).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await audit(req, 'update_user', 'user', targetId, payload);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/recalculate-risk', async (req, res) => {
  try {
    const userId = req.params.id;
    const { data: transactions, error } = await admin.from('transactions').select('id,status,amount,buyer_id,seller_id').or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
    if (error) return res.status(400).json({ error: error.message });
    const ids = (transactions || []).map(x => x.id);
    let disputes = 0, alerts = 0;
    if (ids.length) {
      const [d, a] = await Promise.all([
        admin.from('disputes').select('*', { count: 'exact', head: true }).in('transaction_id', ids),
        admin.from('fraud_alerts').select('*', { count: 'exact', head: true }).in('transaction_id', ids)
      ]);
      disputes = d.count || 0; alerts = a.count || 0;
    }
    const cancelled = (transactions || []).filter(x => ['cancelled','refunded','disputed'].includes(x.status)).length;
    const highValue = (transactions || []).filter(x => Number(x.amount) >= 10000).length;
    const score = Math.min(100, alerts * 25 + disputes * 15 + cancelled * 7 + highValue * 5);
    const level = riskLevel(score);
    const { data, error: updateError } = await admin.from('profiles').update({ risk_score: score, risk_level: level }).eq('id', userId).select().single();
    if (updateError) return res.status(400).json({ error: updateError.message });
    await audit(req, 'recalculate_risk', 'user', userId, { score, level, alerts, disputes, cancelled, high_value: highValue });
    res.json({ profile: data, factors: { alerts, disputes, cancelled, high_value: highValue } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) return res.status(409).json({ error: 'ما تقدر تحذف حسابك الحالي' });
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(targetId);
    if (authError) return res.status(404).json({ error: 'المستخدم غير موجود بالـ Auth' });
    if (!req.body.confirm_email || req.body.confirm_email.toLowerCase() !== authData.user.email?.toLowerCase()) return res.status(422).json({ error: 'اكتب بريد المستخدم للتأكيد' });
    await audit(req, 'delete_user', 'user', targetId, { email: authData.user.email });
    const { error } = await admin.auth.admin.deleteUser(targetId, false);
    if (error) return res.status(400).json({ error: error.message });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/products', async (_req, res) => {
  try {
    const { data, error } = await admin.from('products').select('*,seller:profiles!products_seller_id_fkey(full_name,risk_level)').order('created_at', { ascending: false }).limit(500);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:id/moderation', async (req, res) => {
  try {
    if (!['pending','approved','suspended','rejected'].includes(req.body.moderation_status)) return res.status(422).json({ error: 'حالة المراجعة غير صالحة' });
    const payload = { moderation_status: req.body.moderation_status, moderation_reason: String(req.body.reason || '').trim().slice(0,500), moderated_by: req.user.id, moderated_at: new Date().toISOString(), status: req.body.moderation_status === 'approved' ? 'active' : 'inactive' };
    const { data, error } = await admin.from('products').update(payload).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await audit(req, 'moderate_product', 'product', req.params.id, payload);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const { data, error } = await admin.from('products').delete().eq('id', req.params.id).select('id,title').single();
    if (error) return res.status(400).json({ error: error.message });
    await audit(req, 'delete_product', 'product', req.params.id, { title: data.title });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/transactions', async (_req, res) => {
  try {
    const { data, error } = await admin.from('transactions').select('*,product:products(title),buyer:profiles!transactions_buyer_id_fkey(full_name),seller:profiles!transactions_seller_id_fkey(full_name)').order('created_at', { ascending: false }).limit(500);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/fraud-alerts', async (_req, res) => {
  try {
    const { data, error } = await admin.from('fraud_alerts').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit-logs', async (_req, res) => {
  try {
    const { data, error } = await admin.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(300);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/transactions/:id/resolve-dispute', async (req, res) => {
  try {
    const { beneficiary, notes } = req.body;
    if (!['buyer','seller'].includes(beneficiary)) return res.status(422).json({ error: 'حدد المستفيد' });
    const { data: tx, error } = await admin.from('transactions').select('*').eq('id', req.params.id).single();
    if (error || !tx) return res.status(404).json({ error: 'الصفقة غير موجودة' });

    await admin.from('disputes').update({ status: 'resolved', resolved_by: req.user.id, admin_notes: notes, resolution: beneficiary }).eq('transaction_id', tx.id).eq('status', 'open');
    if (beneficiary === 'buyer' && tx.product_id) await admin.rpc('restore_transaction_stock', { p_transaction_id: tx.id });
    const finalStatus = beneficiary === 'seller' ? 'completed' : 'refunded';
    await admin.from('transactions').update({ status: finalStatus, final_reason: String(notes || '').slice(0,1000), completed_at: new Date().toISOString(), wallet_credited_at: beneficiary === 'seller' ? new Date().toISOString() : null }).eq('id', tx.id);
    await audit(req, 'resolve_dispute', 'transaction', tx.id, { beneficiary, notes });
    res.json({ resolved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
