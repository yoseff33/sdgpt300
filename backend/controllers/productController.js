import crypto from 'node:crypto';
import { admin } from '../utils/supabase.js';

const ALLOWED_FIELDS = [
  'title',
  'description',
  'category',
  'price',
  'quantity',
  'inspection_hours',
  'city',
  'condition',
  'external_url' // <--- تمت الإضافة
];

function cleanProductPayload(body, { partial = false } = {}) {
  const payload = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) payload[field] = body[field];
  }

  if (!partial || payload.title !== undefined) {
    payload.title = String(payload.title || '').trim();
    if (payload.title.length < 3 || payload.title.length > 120) {
      throw Object.assign(new Error('عنوان المنتج لازم يكون بين 3 و120 حرف'), { status: 422 });
    }
  }

  if (payload.description !== undefined) {
    payload.description = String(payload.description || '').trim().slice(0, 3000);
  }
  if (payload.category !== undefined) payload.category = String(payload.category || '').trim().slice(0, 80);
  if (payload.city !== undefined) payload.city = String(payload.city || '').trim().slice(0, 80);
  if (payload.condition !== undefined) payload.condition = String(payload.condition || '').trim().slice(0, 30);
  if (payload.external_url !== undefined) {
    payload.external_url = String(payload.external_url || '').trim().slice(0, 500);
  }

  if (!partial || payload.price !== undefined) {
    payload.price = Number(payload.price);
    if (!Number.isFinite(payload.price) || payload.price <= 0) {
      throw Object.assign(new Error('سعر المنتج غير صالح'), { status: 422 });
    }
  }

  if (payload.quantity !== undefined || !partial) {
    payload.quantity = Math.max(1, Math.floor(Number(payload.quantity || 1)));
  }

  if (payload.inspection_hours !== undefined || !partial) {
    const hours = Number(payload.inspection_hours || 24);
    if (!Number.isFinite(hours)) {
      throw Object.assign(new Error('مهلة الفحص غير صالحة'), { status: 422 });
    }
    payload.inspection_hours = Math.min(168, Math.max(1, Math.floor(hours)));
  }

  return payload;
}

export async function list(req, res) {
  let query = admin
    .from('products')
    .select('*,seller:profiles!products_seller_id_fkey(full_name,nafath_verified)')
    .eq('status', 'active')
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false });

  if (req.query.category) query = query.eq('category', req.query.category);
  if (req.query.min) query = query.gte('price', Number(req.query.min));
  if (req.query.max) query = query.lte('price', Number(req.query.max));
  if (req.query.q) query = query.ilike('title', `%${String(req.query.q).trim().slice(0, 100)}%`);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}

export async function get(req, res) {
  const { data, error } = await admin
    .from('products')
    .select('*,seller:profiles!products_seller_id_fkey(full_name,nafath_verified)')
    .eq('id', req.params.id)
    .eq('status', 'active')
    .eq('moderation_status', 'approved')
    .single();

  if (error || !data) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json(data);
}

export async function create(req, res) {
  // التحقق من نفاذ (اختياري، علق الشرط إذا أردت السماح للجميع)
  // if (!req.user.profile?.nafath_verified) {
  //   return res.status(403).json({ error: 'يلزم التحقق عبر نفاذ قبل البيع' });
  // }

  const payload = cleanProductPayload(req.body);
  let imageUrl = null;

  if (req.file) {
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
    const storagePath = `${req.user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await admin.storage
      .from('product-images')
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (uploadError) throw uploadError;
    imageUrl = admin.storage.from('product-images').getPublicUrl(storagePath).data.publicUrl;
  }

  const { data, error } = await admin
    .from('products')
    .insert({ ...payload, seller_id: req.user.id, image_url: imageUrl, status: 'active' })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}

export async function update(req, res) {
  const payload = cleanProductPayload(req.body, { partial: true });
  if (!Object.keys(payload).length) return res.status(422).json({ error: 'ما فيه بيانات صالحة للتعديل' });

  let query = admin.from('products').update(payload).eq('id', req.params.id);
  if (!['admin', 'manager'].includes(req.user.role)) query = query.eq('seller_id', req.user.id);

  const { data, error } = await query.select().single();
  if (error || !data) return res.status(404).json({ error: 'المنتج غير موجود أو ما عندك صلاحية' });
  res.json(data);
}

export async function remove(req, res) {
  let query = admin.from('products').delete().eq('id', req.params.id);
  if (!['admin', 'manager'].includes(req.user.role)) query = query.eq('seller_id', req.user.id);

  const { data, error } = await query.select('id').maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'المنتج غير موجود أو ما عندك صلاحية' });
  res.status(204).end();
}
