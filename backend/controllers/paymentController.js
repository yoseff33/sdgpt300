import { admin } from '../utils/supabase.js';
import { createMoyasarPayment, createTabbySession, createTamaraSession, verifyHmac } from '../utils/paymentGateways.js';

export async function createSession(req, res) {
  try {
    const { transactionId, method } = req.body;

    if (!transactionId) {
      return res.status(422).json({ error: 'رقم المعاملة مطلوب' });
    }

    // 1. تنظيف الحجوزات المنتهية بدون إيقاف الطلب عند الخطأ
    try {
      await admin.rpc('release_expired_stock_reservations');
    } catch (rpcErr) {
      console.error('RPC Error:', rpcErr);
    }

    // 2. جلب تفاصيل المعاملة مع التحقق من الأخطاء
    const { data: tx, error: txError } = await admin
      .from('transactions')
      .select('*,buyer:profiles!transactions_buyer_id_fkey(full_name,phone)')
      .eq('id', transactionId)
      .single();

    if (txError || !tx) {
      return res.status(404).json({ error: 'المعاملة غير موجودة' });
    }

    if (tx.buyer_id !== req.user.id) {
      return res.status(403).json({ error: 'المشتري فقط يمكنه الدفع' });
    }

    if (tx.status !== 'pending_payment') {
      return res.status(409).json({ error: 'المعاملة ليست بانتظار الدفع' });
    }

    if (tx.stock_reserved && tx.reservation_expires_at && new Date(tx.reservation_expires_at) <= new Date()) {
      return res.status(409).json({ error: 'انتهت مهلة حجز المنتج، ابدأ الطلب من جديد' });
    }

    const buyer = {
      email: req.user.email,
      phone: tx.buyer?.phone,
      name: tx.buyer?.full_name
    };

    let result;
    const amount = tx.buyer_total || tx.amount;
    const description = tx.description || 'معاملة ضمانك';

    // 3. استدعاء بوابات الدفع مع حماية الطلب من التعليق
    if (method === 'moyasar') {
      result = await createMoyasarPayment({ amount, description, transactionId: tx.id });
    } else if (method === 'tabby') {
      result = await createTabbySession({ amount, buyer, transactionId: tx.id });
    } else if (method === 'tamara') {
      result = await createTamaraSession({ amount, buyer, transactionId: tx.id });
    } else {
      return res.status(422).json({ error: 'وسيلة دفع غير مدعومة' });
    }

    if (!result) {
      return res.status(502).json({ error: 'فشل الاتصال ببوابة الدفع' });
    }

    const paymentId = result.id || result.payment?.id || null;
    const redirectUrl = result.url || 
                        result.checkout_url || 
                        result.configuration?.available_products?.installments?.[0]?.web_url || 
                        result.payment?.web_url;

    if (!redirectUrl) {
      return res.status(500).json({ error: 'لم يتم استلام رابط إعادة التوجيه من بوابة الدفع', result });
    }

    // 4. تحديث حالة المعاملة ببيانات الدفع
    await admin
      .from('transactions')
      .update({ payment_method: method, payment_id: paymentId })
      .eq('id', tx.id);

    return res.json({ redirect_url: redirectUrl, result });

  } catch (error) {
    console.error('Error in createSession:', error);
    return res.status(500).json({ error: error.message || 'حدث خطأ داخلي أثناء إنشاء جلسة الدفع' });
  }
}

export async function webhook(req, res) {
  try {
    const gateway = req.params.gateway;
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];
    const secret = process.env[`${gateway.toUpperCase()}_WEBHOOK_SECRET`];

    if (!secret || !verifyHmac(raw, signature, secret)) {
      return res.status(401).json({ error: 'توقيع webhook غير صالح' });
    }

    const body = req.body;
    const paid = ['paid', 'authorized', 'approved', 'CAPTURED'].includes(body.status || body.event_type || body.payment?.status);
    const paymentId = body.id || body.payment_id || body.payment?.id;
    const transactionId = body.metadata?.transaction_id || body.order_reference_id || body.payment?.order?.reference_id;

    let query = admin.from('transactions').select('*,product:products(inspection_hours)').limit(1);
    query = transactionId ? query.eq('id', transactionId) : query.eq('payment_id', paymentId);

    const { data: rows, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    if (paid && rows?.[0]) {
      const tx = rows[0];
      if (tx.product_id && tx.stock_reserved) {
        const { error: stockError } = await admin.rpc('finalize_transaction_stock', { p_transaction_id: tx.id });
        if (stockError) console.error('Stock Finalize Error:', stockError);
      }
      const hours = tx.inspection_hours || tx.product?.inspection_hours || 24;
      await admin
        .from('transactions')
        .update({ 
          status: 'funds_held', 
          payment_id: paymentId, 
          inspection_deadline: new Date(Date.now() + hours * 3600000).toISOString() 
        })
        .eq('id', tx.id)
        .eq('status', 'pending_payment');
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('Error in Webhook:', error);
    return res.status(500).json({ error: error.message });
  }
}
