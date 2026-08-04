import { admin } from '../utils/supabase.js';
import { analyzeTransaction } from '../utils/fraudDetection.js';

const COMMISSION_RATE = Number(process.env.COMMISSION_RATE || 0.03);
const MIN_INSPECTION_HOURS = 1;
const MAX_INSPECTION_HOURS = 168;

const notify = async (ids, message) => {
  const recipients = [...new Set(ids.filter(Boolean))];
  if (!recipients.length) return;
  const { error } = await admin.from('notifications').insert(
    recipients.map(user_id => ({ user_id, message }))
  );
  if (error) throw error;
};

export async function create(req, res) {
  const productId = req.body.product_id;
  if (!productId) return res.status(422).json({ error: 'حدد المنتج أولاً' });

  const { data: product, error: productError } = await admin
    .from('products')
    .select('id,title,price,seller_id,inspection_hours,status,quantity')
    .eq('id', productId)
    .single();

  if (productError || !product) return res.status(404).json({ error: 'المنتج غير موجود' });
  if (product.status && product.status !== 'active') return res.status(409).json({ error: 'المنتج غير متاح حالياً' });
  if (Number(product.quantity ?? 1) < 1) return res.status(409).json({ error: 'المنتج غير متوفر حالياً' });
  if (product.seller_id === req.user.id) return res.status(422).json({ error: 'ما تقدر تشتري منتجك' });

  const amount = Number(product.price);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(422).json({ error: 'سعر المنتج غير صالح' });

  const requestedHours = Number(req.body.inspection_hours || product.inspection_hours || 24);
  const inspectionHours = Math.min(MAX_INSPECTION_HOURS, Math.max(MIN_INSPECTION_HOURS, requestedHours));
  const commission = Number((amount * COMMISSION_RATE).toFixed(2));

  const transaction = {
    product_id: product.id,
    buyer_id: req.user.id,
    seller_id: product.seller_id,
    amount,
    commission,
    description: product.title,
    inspection_hours: inspectionHours,
    status: 'pending_payment'
  };

  const { data, error } = await admin
    .from('transactions')
    .insert(transaction)
    .select()
    .single();

  if (error) throw error;
  await analyzeTransaction(data);

  const appUrl = (process.env.APP_URL || '').split(',')[0].replace(/\/$/, '');
  res.status(201).json({
    ...data,
    share_url: appUrl ? `${appUrl}/transaction.html?id=${data.id}` : undefined
  });
}

export async function list(req, res) {
  let query = admin
    .from('transactions')
    .select('*,product:products(title,image_url)')
    .order('created_at', { ascending: false });

  if (!['admin', 'manager', 'support'].includes(req.user.role)) {
    query = query.or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`);
  }
  if (req.query.role === 'buyer') query = query.eq('buyer_id', req.user.id);
  if (req.query.role === 'seller') query = query.eq('seller_id', req.user.id);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}

export async function get(req, res) {
  const { data, error } = await admin
    .from('transactions')
    .select('*,product:products(*),buyer:profiles!transactions_buyer_id_fkey(full_name),seller:profiles!transactions_seller_id_fkey(full_name),disputes(*)')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'الصفقة غير موجودة' });
  if (!['admin', 'manager', 'support'].includes(req.user.role) && ![data.buyer_id, data.seller_id].includes(req.user.id)) {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }
  res.json(data);
}

async function updateStatus(req, res, expectedStatus, nextStatus, party) {
  const { data: transaction, error: fetchError } = await admin
    .from('transactions')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (fetchError || !transaction) return res.status(404).json({ error: 'الصفقة غير موجودة' });
  if (transaction[`${party}_id`] !== req.user.id) return res.status(403).json({ error: 'ليس لديك صلاحية' });
  if (transaction.status !== expectedStatus) return res.status(409).json({ error: 'حالة الصفقة ما تسمح بهالإجراء' });

  if (nextStatus === 'completed') {
    const { count, error: disputeError } = await admin
      .from('disputes')
      .select('id', { count: 'exact', head: true })
      .eq('transaction_id', transaction.id)
      .eq('status', 'open');
    if (disputeError) throw disputeError;
    if (count) return res.status(409).json({ error: 'يوجد نزاع مفتوح' });
  }

  const changes = { status: nextStatus };
  if (nextStatus === 'shipped') {
    changes.inspection_deadline = new Date(
      Date.now() + Number(transaction.inspection_hours || 24) * 3_600_000
    ).toISOString();
  }

  const { data, error } = await admin
    .from('transactions')
    .update(changes)
    .eq('id', transaction.id)
    .eq('status', expectedStatus)
    .select()
    .single();

  if (error) throw error;
  await notify([transaction.buyer_id, transaction.seller_id], `تحديث الصفقة: ${nextStatus}`);
  res.json(data);
}

export const ship = (req, res) => updateStatus(req, res, 'funds_held', 'shipped', 'seller');
export const confirmReceipt = (req, res) => updateStatus(req, res, 'shipped', 'completed', 'buyer');

export async function dispute(req, res) {
  const reason = String(req.body.reason || '').trim();
  const description = String(req.body.description || reason).trim();
  if (reason.length < 5) return res.status(422).json({ error: 'وضح المشكلة بشكل مختصر' });

  const { data: transaction, error: fetchError } = await admin
    .from('transactions')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (fetchError || !transaction) return res.status(404).json({ error: 'الصفقة غير موجودة' });
  if (![transaction.buyer_id, transaction.seller_id].includes(req.user.id)) {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }
  if (!['funds_held', 'shipped'].includes(transaction.status)) {
    return res.status(409).json({ error: 'حالة الصفقة ما تسمح بفتح نزاع' });
  }

  const { count, error: countError } = await admin
    .from('disputes')
    .select('id', { count: 'exact', head: true })
    .eq('transaction_id', transaction.id)
    .eq('status', 'open');
  if (countError) throw countError;
  if (count) return res.status(409).json({ error: 'فيه نزاع مفتوح على الصفقة بالفعل' });

  const { data, error } = await admin
    .from('disputes')
    .insert({ transaction_id: transaction.id, raised_by: req.user.id, reason, description })
    .select()
    .single();
  if (error) throw error;

  const { error: updateError } = await admin
    .from('transactions')
    .update({ status: 'disputed' })
    .eq('id', transaction.id)
    .in('status', ['funds_held', 'shipped']);
  if (updateError) throw updateError;

  await notify([transaction.buyer_id, transaction.seller_id], 'تم فتح مشكلة على الصفقة');
  res.status(201).json(data);
}

// ==========================================
// دالة إنشاء رابط دفع خاص (الميزة الجديدة)
// ==========================================
export async function createPaymentLink(req, res) {
  const { amount, description, buyer_email } = req.body;

  // التحقق من صحة المبلغ
  const finalAmount = Number(amount);
  if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
    return res.status(422).json({ error: 'المبلغ غير صالح' });
  }

  // تنظيف الوصف
  const finalDescription = String(description || 'رابط دفع مباشر').trim().slice(0, 255);

  // حساب العمولة
  const rate = Number(process.env.COMMISSION_RATE || 0.03);
  const commission = Number((finalAmount * rate).toFixed(2));

  // إنشاء المعاملة مباشرة بدون منتج (product_id = null)
  const transaction = {
    seller_id: req.user.id,
    amount: finalAmount,
    commission,
    description: finalDescription,
    status: 'pending_payment',
    buyer_id: null, // يترك فارغاً حتى يدفع المشتري
    product_id: null, // لا يرتبط بمنتج محدد
    inspection_hours: 24, // قيمة افتراضية
    payment_method: null
  };

  const { data, error } = await admin
    .from('transactions')
    .insert(transaction)
    .select()
    .single();

  if (error) {
    console.error('خطأ في إنشاء رابط الدفع:', error);
    return res.status(500).json({ error: 'فشل في إنشاء الرابط' });
  }

  // إنشاء الرابط الفريد
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const paymentLink = `${appUrl}/pay/${data.id}`;

  res.status(201).json({
    ...data,
    payment_link: paymentLink,
    message: 'تم إنشاء رابط الدفع بنجاح'
  });
}
