export const token = () => localStorage.getItem('damanak_token');

export async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token()) {
    headers.Authorization = `Bearer ${token()}`;
  }
  
  // تعديل مسار طلب الـ API ليكون نسبياً بدلاً من المطلق
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const r = await fetch(`api/${cleanPath}`, { ...options, headers });
  const data = r.status === 204 ? null : await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'تعذر إكمال الطلب');
  return data;
}

export const money = n => new Intl.NumberFormat('ar-SA', {
  style: 'currency',
  currency: 'SAR'
}).format(n);
