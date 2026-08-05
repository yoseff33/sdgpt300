import { admin } from '../utils/supabase.js';

const CLOSED = ['completed', 'refunded', 'cancelled'];
const applyFilters = (query, req) => {
  if (req.query.status) query = query.eq('status', req.query.status);
  if (req.query.from) query = query.gte('created_at', new Date(req.query.from).toISOString());
  if (req.query.to) {
    const end = new Date(req.query.to); end.setHours(23, 59, 59, 999);
    query = query.lte('created_at', end.toISOString());
  }
  return query;
};

const metrics = rows => {
  const closed = rows.filter(x => CLOSED.includes(x.status));
  const count = status => rows.filter(x => x.status === status).length;
  return {
    total: rows.length,
    completed: count('completed'), refunded: count('refunded'), cancelled: count('cancelled'),
    inspection: count('shipped'), preparing: count('funds_held'), disputed: count('disputed'),
    success_rate: closed.length ? Number((count('completed') / closed.length * 100).toFixed(1)) : 0,
    failure_rate: closed.length ? Number((count('refunded') / closed.length * 100).toFixed(1)) : 0,
    cancellation_rate: closed.length ? Number((count('cancelled') / closed.length * 100).toFixed(1)) : 0,
    sales_volume: rows.filter(x => x.status === 'completed').reduce((s,x) => s + Number(x.amount || 0), 0),
    commissions: rows.filter(x => x.status === 'completed').reduce((s,x) => s + Number(x.commission || 0), 0),
    commission_vat: rows.filter(x => x.status === 'completed').reduce((s,x) => s + Number(x.commission_vat || 0), 0),
    seller_net: rows.filter(x => x.status === 'completed').reduce((s,x) => s + Number(x.seller_net || 0), 0)
  };
};

export async function accountReport(req, res) {
  const role = req.query.role === 'seller' ? 'seller' : 'buyer';
  let query = admin.from('transactions').select('*,product:products(title,category,image_url),buyer:profiles!transactions_buyer_id_fkey(full_name),seller:profiles!transactions_seller_id_fkey(full_name)').eq(`${role}_id`, req.user.id).order('created_at', { ascending: false });
  query = applyFilters(query, req);
  const { data, error } = await query;
  if (error) throw error;
  const reportMetrics = metrics(data || []);
  if (role === 'seller') {
    const { data: ratings } = await admin.from('ratings').select('score').eq('seller_id', req.user.id);
    reportMetrics.average_rating = ratings?.length ? Number((ratings.reduce((s,x) => s + x.score, 0) / ratings.length).toFixed(1)) : 0;
  }
  res.json({ role, metrics: reportMetrics, rows: data || [] });
}

export async function rateSeller(req, res) {
  const score = Number(req.body.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) return res.status(422).json({ error: 'التقييم لازم يكون من 1 إلى 5' });
  const { data: tx, error } = await admin.from('transactions').select('id,buyer_id,seller_id,status').eq('id', req.params.id).single();
  if (error || !tx) return res.status(404).json({ error: 'العملية غير موجودة' });
  if (tx.buyer_id !== req.user.id || tx.status !== 'completed') return res.status(403).json({ error: 'التقييم متاح للمشتري بعد اكتمال العملية فقط' });
  const { data, error: ratingError } = await admin.from('ratings').upsert({ transaction_id: tx.id, buyer_id: tx.buyer_id, seller_id: tx.seller_id, score, comment: String(req.body.comment || '').trim().slice(0,500) }, { onConflict: 'transaction_id' }).select().single();
  if (ratingError) throw ratingError;
  res.json(data);
}

export async function adminReport(req, res) {
  let query = admin.from('transactions').select('*,product:products(title,category),buyer:profiles!transactions_buyer_id_fkey(full_name),seller:profiles!transactions_seller_id_fkey(full_name)').order('created_at', { ascending: false });
  query = applyFilters(query, req);
  if (req.query.buyer_id) query = query.eq('buyer_id', req.query.buyer_id);
  if (req.query.seller_id) query = query.eq('seller_id', req.query.seller_id);
  const { data, error } = await query;
  if (error) throw error;
  const rows = req.query.category ? (data || []).filter(x => x.product?.category === req.query.category) : (data || []);
  res.json({ metrics: metrics(rows), rows });
}

export async function invoice(req, res) {
  const { data, error } = await admin.from('transactions').select('*,product:products(title,category),buyer:profiles!transactions_buyer_id_fkey(full_name,city),seller:profiles!transactions_seller_id_fkey(full_name,store_name,city)').eq('id', req.params.id).single();
  if (error || !data) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
  const privileged = ['admin','manager','support'].includes(req.user.role);
  if (!privileged && ![data.buyer_id, data.seller_id].includes(req.user.id)) return res.status(403).json({ error: 'ليس لديك صلاحية لعرض الفاتورة' });
  if (!CLOSED.includes(data.status)) return res.status(409).json({ error: 'تظهر الفاتورة بعد إغلاق العملية' });
  res.json({
    invoice_number: `DM-${String(data.id).split('-')[0].toUpperCase()}`,
    issued_at: data.completed_at || data.created_at,
    transaction: data,
    tax_note: 'ضريبة القيمة المضافة محسوبة على عمولة خدمة الوساطة فقط وفق إعداد المنصة.'
  });
}
