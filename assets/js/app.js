import { api, money, token } from './api.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const statusMap = {
  pending_payment: 'بانتظار دفع المشتري',
  funds_held: 'تم حفظ المبلغ',
  shipped: 'بدأت مهلة الفحص',
  completed: 'تمت الصفقة',
  disputed: 'فيه مشكلة بالصفقة',
  cancelled: 'تم إلغاء الصفقة',
  refunded: 'تم استرداد المبلغ'
};

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

function shell() {
  const header = $('[data-header]');
  const footer = $('[data-footer]');

  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <a class="brand" href="index.html" aria-label="ضمانك - الرئيسية">
          <span class="brand__mark">ض</span><span>ضمانك</span>
        </a>
        <nav aria-label="التنقل الرئيسي">
          <a href="index.html">السوق</a>
          <a href="how-it-works.html">كيف تعمل؟</a>
          <a href="dashboard.html">لوحتي</a>
          <a href="account.html">حسابي</a>
          <a class="bell" href="dashboard.html" aria-label="الإشعارات">🔔 <b class="badge" id="badge">0</b></a>
          <button id="themeToggle" type="button" aria-label="تغيير المظهر">🌙</button>
        </nav>
      </header>`;
  }

  if (footer) {
    footer.innerHTML = `
      <footer>
        <div><b>ضمانك</b><p>بيع واشتر وأنت مرتاح، حقك محفوظ.</p></div>
        <div><h4>روابط سريعة</h4><a href="how-it-works.html">كيف تعمل؟</a><br><a href="faq.html">الأسئلة الشائعة</a><br><a href="contact.html">تواصل معنا</a></div>
        <div><h4>تنبيه مهم</h4><p>لا تحوّل أي مبلغ خارج المنصة إذا تبي حماية الصفقة.</p></div>
        <small>© 2026 ضمانك. الخدمات الحكومية ووسائل الدفع تظهر عند تفعيل الربط الفعلي.</small>
      </footer>`;
  }

  loadTheme();
  $('#themeToggle')?.addEventListener('click', toggleTheme);
}

function toggleTheme() {
  const dark = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  updateThemeIcon();
}

function loadTheme() {
  const saved = localStorage.getItem('theme');
  const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  updateThemeIcon();
}

function updateThemeIcon() {
  const button = $('#themeToggle');
  if (button) button.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
}

function toast(message, type = 'info') {
  const old = $('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function initCalculator() {
  const form = $('#escrowCalculator');
  if (!form) return;

  const feeRate = 0.03;
  const vatRate = 0.15;
  const amountInput = $('#dealAmount');
  const payer = $('#feePayer');

  const calculate = () => {
    const normalized = amountInput.value.replace(/[٠-٩]/g, n => '٠١٢٣٤٥٦٧٨٩'.indexOf(n)).replace(/,/g, '');
    const amount = Math.max(0, Number.parseFloat(normalized) || 0);
    const fee = amount * feeRate;
    const vat = fee * vatRate;
    const totalFees = fee + vat;
    let buyerTotal = amount;
    let sellerNet = amount;

    if (payer.value === 'buyer') buyerTotal += totalFees;
    if (payer.value === 'seller') sellerNet -= totalFees;
    if (payer.value === 'split') {
      buyerTotal += totalFees / 2;
      sellerNet -= totalFees / 2;
    }

    $('#calcAmount').textContent = money(amount);
    $('#calcFee').textContent = money(fee);
    $('#calcVat').textContent = money(vat);
    $('#calcBuyerTotal').textContent = money(buyerTotal);
    $('#calcSellerNet').textContent = money(Math.max(0, sellerNet));
  };

  amountInput.addEventListener('input', calculate);
  payer.addEventListener('change', calculate);
  calculate();
}

async function home() {
  const grid = $('#products');
  const form = $('#filters');
  if (!grid || !form) return;

  const loadProducts = async () => {
    grid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
    try {
      const params = new URLSearchParams(new FormData(form));
      [...params.entries()].forEach(([key, value]) => { if (!value) params.delete(key); });
      const rows = await api(`/products?${params.toString()}`);
      $('#resultsCount').textContent = rows.length ? `${rows.length} إعلان مطابق` : 'ما لقينا نتائج بنفس اختياراتك.';
      grid.innerHTML = rows.length ? rows.map(product => `
        <article class="card product-card">
          <img loading="lazy" src="${escapeHtml(product.image_url || 'assets/img/placeholder.svg')}" alt="${escapeHtml(product.title)}">
          <span class="tag">${escapeHtml(product.category || 'عام')}</span>
          <h3>${escapeHtml(product.title)}</h3>
          <p>${escapeHtml(product.description || 'تفاصيل المنتج متوفرة داخل الإعلان.')}</p>
          <b>${money(product.price)}</b>
          <p class="seller">${product.seller?.nafath_verified ? 'البائع موثق ✓' : 'التوثيق غير مكتمل'}</p>
          <a class="button button--primary" href="product.html?id=${encodeURIComponent(product.id)}">اشتره بضمانك</a>
        </article>`).join('') : '<div class="card"><h3>ما لقينا نتائج</h3><p>جرّب توسّع البحث شوي أو امسح الفلاتر.</p></div>';
    } catch (error) {
      $('#resultsCount').textContent = 'تعذر تحميل السوق';
      grid.innerHTML = `<div class="card"><h3>تعذر تحميل المنتجات</h3><p>${escapeHtml(error.message)}</p></div>`;
    }
  };

  form.addEventListener('submit', event => { event.preventDefault(); loadProducts(); });
  $('#clearFilters')?.addEventListener('click', () => { form.reset(); loadProducts(); });
  await loadProducts();
}

function initAuth() {
  const form = $('#auth');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"], button:not([type])');
    submit.disabled = true;
    const payload = Object.fromEntries(new FormData(form));
    try {
      const data = await api(`/auth/${payload.mode}`, { method: 'POST', body: JSON.stringify(payload) });
      if (payload.mode === 'signup') {
        $('#msg').textContent = 'تم إنشاء الحساب. تحقق من بريدك ثم سجل الدخول.';
      } else {
        localStorage.setItem('damanak_token', data.session.access_token);
        location.href = 'dashboard.html';
      }
    } catch (error) {
      $('#msg').textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
}

async function productPage() {
  const container = $('#product');
  if (!container) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return container.innerHTML = '<div class="card"><h1>المنتج غير محدد</h1><a class="button" href="index.html#market">ارجع للسوق</a></div>';

  try {
    const product = await api(`/products/${encodeURIComponent(id)}`);
    container.innerHTML = `
      <img src="${escapeHtml(product.image_url || 'assets/img/placeholder.svg')}" alt="${escapeHtml(product.title)}">
      <section class="card">
        <span class="tag">${escapeHtml(product.category || 'عام')}</span>
        <h1>${escapeHtml(product.title)}</h1>
        <h2>${money(product.price)}</h2>
        <p>${escapeHtml(product.description || '')}</p>
        <p><strong>مهلة الفحص:</strong> ${Number(product.inspection_hours || 24)} ساعة</p>
        <p><strong>البائع:</strong> ${escapeHtml(product.seller?.full_name || 'غير ظاهر')} · ${product.seller?.nafath_verified ? 'موثق ✓' : 'غير موثق'}</p>
        <div class="calculator-note">لا تحول أي مبلغ خارج ضمانك إذا تبي حماية الصفقة.</div>
        <div class="actions"><button id="buy" class="button button--primary">ابدأ صفقة مضمونة</button><a class="button button--secondary" href="contact.html">تواصل مع البائع</a></div>
      </section>`;

    $('#buy')?.addEventListener('click', async () => {
      if (!token()) return location.href = 'login.html';
      try {
        const transaction = await api('/transactions', {
          method: 'POST',
          body: JSON.stringify({ product_id: product.id, seller_id: product.seller_id, amount: product.price, inspection_hours: product.inspection_hours || 24 })
        });
        location.href = `transaction.html?id=${encodeURIComponent(transaction.id)}`;
      } catch (error) { toast(error.message, 'error'); }
    });
  } catch (error) {
    container.innerHTML = `<div class="card"><h1>تعذر عرض المنتج</h1><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function transactionPage() {
  const container = $('#transaction');
  if (!container) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return container.innerHTML = '<div class="card"><h1>الصفقة غير محددة</h1></div>';

  try {
    const transaction = await api(`/transactions/${encodeURIComponent(id)}`);
    container.innerHTML = `
      <div class="card">
        <span class="status ${escapeHtml(transaction.status)}">${escapeHtml(statusMap[transaction.status] || transaction.status)}</span>
        <h1>${escapeHtml(transaction.product?.title || 'صفقة مباشرة')}</h1>
        <h2>${money(transaction.amount)}</h2>
        <p>رسوم ضمانك: ${money(transaction.commission)}</p>
        ${transaction.inspection_deadline ? `<p id="deadline" data-deadline="${escapeHtml(transaction.inspection_deadline)}"></p>` : ''}
        <div class="actions">
          ${transaction.status === 'pending_payment' ? '<button data-pay="moyasar">مدى / Apple Pay</button><button data-pay="tabby">تابي</button><button data-pay="tamara">تمارا</button>' : ''}
          ${transaction.status === 'funds_held' ? '<button id="ship">تأكيد التسليم</button>' : ''}
          ${transaction.status === 'shipped' ? '<button id="receive">استلمت وكل شيء تمام</button>' : ''}
          ${['funds_held', 'shipped'].includes(transaction.status) ? '<button class="button danger" id="dispute">عندي مشكلة بالصفقة</button>' : ''}
          <button class="button button--secondary" id="share">نسخ رابط الصفقة</button>
        </div>
      </div>`;

    $$('[data-pay]').forEach(button => button.addEventListener('click', async () => {
      try {
        const session = await api('/payments/create-session', { method: 'POST', body: JSON.stringify({ transactionId: id, method: button.dataset.pay }) });
        if (!session?.redirect_url) throw new Error('خدمة الدفع غير مفعلة حالياً.');
        location.href = session.redirect_url;
      } catch (error) { toast(error.message, 'error'); }
    }));

    const act = async action => {
      try { await api(`/transactions/${encodeURIComponent(id)}/${action}`, { method: 'PUT' }); location.reload(); }
      catch (error) { toast(error.message, 'error'); }
    };

    $('#ship')?.addEventListener('click', () => act('ship'));
    $('#receive')?.addEventListener('click', () => act('confirm-receipt'));
    $('#dispute')?.addEventListener('click', async () => {
      const reason = window.prompt('اكتب المشكلة باختصار');
      if (!reason?.trim()) return;
      try {
        await api(`/transactions/${encodeURIComponent(id)}/raise-dispute`, { method: 'PUT', body: JSON.stringify({ reason: reason.trim(), description: reason.trim() }) });
        location.reload();
      } catch (error) { toast(error.message, 'error'); }
    });
    $('#share')?.addEventListener('click', async () => { await navigator.clipboard.writeText(location.href); toast('تم نسخ رابط الصفقة', 'success'); });

    const deadline = $('#deadline');
    if (deadline) {
      const tick = () => {
        const seconds = Math.max(0, Math.floor((new Date(deadline.dataset.deadline) - Date.now()) / 1000));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        deadline.textContent = `المتبقي من مهلة الفحص: ${hours} ساعة و${minutes} دقيقة`;
      };
      tick(); setInterval(tick, 60000);
    }
  } catch (error) {
    container.innerHTML = `<div class="card"><h1>تعذر عرض الصفقة</h1><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function dashboardPage() {
  const container = $('#dashboard');
  if (!container) return;
  if (!token()) return location.href = 'login.html';
  try {
    const rows = await api('/transactions');
    const needsAction = rows.filter(item => ['pending_payment', 'funds_held', 'shipped'].includes(item.status));
    container.innerHTML = `
      <div class="section-heading"><span class="eyebrow">لوحتك</span><h1>وش يحتاج منك الآن؟</h1></div>
      <div class="stats">
        <div class="card"><small>كل الصفقات</small><strong>${rows.length}</strong></div>
        <div class="card"><small>تحتاج إجراء</small><strong>${needsAction.length}</strong></div>
        <div class="card"><small>إجمالي المبالغ</small><strong>${money(rows.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></div>
      </div>
      <div class="card"><h2>صفقاتي</h2>${rows.length ? rows.map(item => `<a class="row" href="transaction.html?id=${encodeURIComponent(item.id)}"><span>${escapeHtml(item.product?.title || 'صفقة مباشرة')}</span><b>${money(item.amount)}</b><em>${escapeHtml(statusMap[item.status] || item.status)}</em></a>`).join('') : '<p>ما عندك صفقات حالياً.</p>'}</div>`;
  } catch (error) {
    container.innerHTML = `<div class="card"><h1>تعذر تحميل لوحتك</h1><p>${escapeHtml(error.message)}</p><a class="button" href="login.html">تسجيل الدخول</a></div>`;
  }
}

async function loadNotifications() {
  if (!token() || !$('#badge')) return;
  try {
    const rows = await api('/notifications');
    $('#badge').textContent = String(rows.filter(item => !item.read).length || 0);
  } catch { $('#badge').textContent = '0'; }
}

function init() {
  shell();
  initCalculator();
  home();
  initAuth();
  productPage();
  transactionPage();
  dashboardPage();
  loadNotifications();
}

document.addEventListener('DOMContentLoaded', init);
