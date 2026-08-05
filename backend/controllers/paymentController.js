import { admin } from '../utils/supabase.js';
import { createMoyasarPayment, createTabbySession, createTamaraSession, verifyHmac } from '../utils/paymentGateways.js';

export async function createSession(req, res) {
  await admin.rpc('release_expired_stock_reservations');
  const { data: tx } = await admin.from('transactions').select('*,buyer:profiles!transactions_buyer_id_fkey(full_name,phone)').eq('id', req.body.transactionId).single();
  if (!tx || tx.buyer_id !== req.user.id) return res.status(403).json({ error: 'المشتري فقط يمكنه الدفع' });
  if (tx.status !== 'pending_payment') return res.status(409).json({ error: 'المعاملة ليست بانتظار الدفع' });
  if (tx.stock_reserved && tx.reservation_expires_at && new Date(tx.reservation_expires_at) <= new Date()) return res.status(409).json({ error: 'انتهت مهلة حجز المنتج، ابدأ الطلب من جديد' });
  const buyer = { email: req.user.email, phone: tx.buyer?.phone, name: tx.buyer?.full_name };
  let result;
  if (req.body.method === 'moyasar') result = await createMoyasarPayment({ amount: tx.buyer_total || tx.amount, description: tx.description || 'معاملة ضمانك', transactionId: tx.id });
  else if (req.body.method === 'tabby') result = await createTabbySession({ amount: tx.buyer_total || tx.amount, buyer, transactionId: tx.id });
  else if (req.body.method === 'tamara') result = await createTamaraSession({ amount: tx.buyer_total || tx.amount, buyer, transactionId: tx.id });
  else return res.status(422).json({ error: 'وسيلة دفع غير مدعومة' });
  await admin.from('transactions').update({ payment_method: req.body.method, payment_id: result.id || result.payment?.id }).eq('id', tx.id);
  res.json({ redirect_url: result.url || result.checkout_url || result.configuration?.available_products?.installments?.[0]?.web_url || result.payment?.web_url, result });
}

export async function webhook(req, res) {
  const gateway = req.params.gateway, raw = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];
  const secret = process.env[`${gateway.toUpperCase()}_WEBHOOK_SECRET`];
  if (!verifyHmac(raw, signature, secret)) return res.status(401).json({ error: 'توقيع webhook غير صالح' });
  const body = req.body;
  const paid = ['paid','authorized','approved','CAPTURED'].includes(body.status || body.event_type || body.payment?.status);
  const paymentId = body.id || body.payment_id || body.payment?.id;
  const transactionId = body.metadata?.transaction_id || body.order_reference_id || body.payment?.order?.reference_id;
  let query = admin.from('transactions').select('*,product:products(inspection_hours)').limit(1);
  query = transactionId ? query.eq('id', transactionId) : query.eq('payment_id', paymentId);
  const { data: rows, error } = await query;
  if (error) throw error;
  if (paid && rows?.[0]) {
    const tx = rows[0];
    if (tx.product_id && tx.stock_reserved) {
      const { error: stockError } = await admin.rpc('finalize_transaction_stock', { p_transaction_id: tx.id });
      if (stockError) throw stockError;
    }
    const hours = tx.inspection_hours || tx.product?.inspection_hours || 24;
    await admin.from('transactions').update({ status: 'funds_held', payment_id: paymentId, inspection_deadline: new Date(Date.now() + hours * 3600000).toISOString() }).eq('id', tx.id).eq('status', 'pending_payment');
  }
  res.json({ received: true });
}
