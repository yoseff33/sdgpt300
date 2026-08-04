export const token = () => localStorage.getItem('damanak_token');

export async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token()) {
    headers.Authorization = `Bearer ${token()}`;
  }
  const r = await fetch(`/api${path}`, { ...options, headers });
  const data = r.status === 204 ? null : await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'تعذر إكمال الطلب');
  return data;
}

export const money = n => new Intl.NumberFormat('ar-SA', {
  style: 'currency',
  currency: 'SAR'
}).format(n);
