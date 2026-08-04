const TOKEN_KEY = 'damanak_token';

/**
 * رابط الباك إند الحقيقي الخارجي (مثال: https://your-backend.onrender.com/api)
 * إذا حطيت الرابط في window.DAMANAK_CONFIG بياخذه مباشرة، 
 * وإذا ما حطيته راح يستبدل الرابط الافتراضي بالرابط اللي تحطه تحت بدال الرابط الاحتياطي.
 */
const DEFAULT_BACKEND_URL = 'https://damanak-backend.example.com/api'; // استبدل هذا برابط سيرفرك الحقيقي

const configuredBaseUrl = window.DAMANAK_CONFIG?.apiBaseUrl?.trim();
const API_BASE_URL = (configuredBaseUrl || DEFAULT_BACKEND_URL).replace(/\/+$/, '');

export const token = () => localStorage.getItem(TOKEN_KEY);

export function setToken(value) {
  if (value) {
    localStorage.setItem(TOKEN_KEY, value);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function buildUrl(path) {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

async function parseResponse(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => '');
  return text ? { message: text } : {};
}

function getErrorMessage(response, data) {
  if (data?.error) return data.error;
  if (data?.message) return data.message;

  if (response.status === 401) return 'انتهت جلسة الدخول. سجل دخولك من جديد.';
  if (response.status === 403) return 'ما عندك صلاحية لتنفيذ هالإجراء.';
  if (response.status === 404) return 'الخدمة أو البيانات المطلوبة غير موجودة.';
  if (response.status === 429) return 'طلباتك كثيرة حالياً. جرّب بعد شوي.';
  if (response.status >= 500) return 'صار خلل بالخدمة. جرّب مرة ثانية بعد شوي.';

  return 'تعذر إكمال الطلب.';
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const bodyIsFormData = options.body instanceof FormData;

  if (options.body != null && !bodyIsFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const accessToken = token();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs) || 20000;
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildUrl(path), {
      ...options,
      headers,
      signal: options.signal || controller.signal,
      credentials: options.credentials || 'omit'
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      if (response.status === 401) clearToken();

      const error = new Error(getErrorMessage(response, data));
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('تأخر الاتصال بالخدمة. تأكد من الشبكة وجرّب مرة ثانية.');
    }

    if (error instanceof TypeError) {
      throw new Error('تعذر الاتصال بالخدمة. تأكد أن رابط الباك إند صحيح وأن CORS مفعّل.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export const money = value => {
  const amount = Number(value);
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(amount) ? amount : 0);
};

export { API_BASE_URL };
