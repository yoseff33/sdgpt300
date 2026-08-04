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

function icon(name, className = '') {
  const paths = {
    shield: '<path d="M12 3 4.5 6v5.2c0 4.7 3.2 8.5 7.5 9.8 4.3-1.3 7.5-5.1 7.5-9.8V6L12 3Z"/><path d="m8.7 12 2.1 2.1 4.6-4.6"/>',
    moon: '<path d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function shell() {
  const header = $('[data-header]');
  const footer = $('[data-footer]');
  const loggedIn = Boolean(token());

  if (header) {
    header.innerHTML = `
      <div class="top-strip">
        <div class="container top-strip__inner">
          <span>منصة سعودية للصفقات الآمنة</span>
          <div><strong>تنبيه:</strong> لا تحول خارج المنصة <a href="faq.html">مركز المساعدة</a></div>
        </div>
      </div>
      <header class="site-header">
        <div class="container site-header__inner">
          <a class="brand" href="index.html" aria-label="ضمانك - الرئيسية">
            <span class="brand__mark">${icon('shield')}<b>ض</b></span>
            <span class="brand__text"><strong>ضمانك</strong><small>سوق آمن</small></span>
          </a>
          <nav class="desktop-nav" aria-label="التنقل الرئيسي">
            <a href="index.html#market">السوق</a><a href="how-it-works.html">كيف تعمل؟</a><a href="index.html#trust">الأمان والحماية</a><a href="faq.html">مركز المساعدة</a>
          </nav>
          <div class="header-tools">
            <a class="icon-button header-search" href="index.html#market" aria-label="البحث">${icon('search')}</a>
            <a class="icon-button" href="dashboard.html" aria-label="الإشعارات">${icon('bell')}<b class="badge" id="badge">0</b></a>
            <button class="icon-button" id="themeToggle" type="button" aria-label="تغيير المظهر">${icon('moon')}</button>
            ${loggedIn ? `<a class="account-link" href="account.html">${icon('user')}<span>حسابي</span></a>` : '<a class="login-link" href="login.html">دخول</a>'}
            <a class="button button--primary add-listing" href="product.html">${icon('plus')}<span>أضف إعلانك</span></a>
            <button class="icon-button menu-toggle" id="menuToggle" type="button" aria-label="فتح القائمة" aria-expanded="false">${icon('menu')}</button>
          </div>
        </div>
        <div class="mobile-drawer" id="mobileDrawer" aria-hidden="true">
          <div class="mobile-drawer__head"><b>القائمة</b><button class="icon-button" id="closeMenu" type="button" aria-label="إغلاق القائمة">${icon('close')}</button></div>
          <nav><a href="index.html#market">السوق</a><a href="how-it-works.html">كيف تعمل؟</a><a href="faq.html">مركز المساعدة</a><a href="dashboard.html">صفقاتي</a><a href="account.html">حسابي</a></nav>
        </div>
        <div class="drawer-backdrop" id="drawerBackdrop"></div>
      </header>
      <nav class="mobile-bottom-nav" aria-label="التنقل السريع">
        <a href="index.html">${icon('shield')}<span>الرئيسية</span></a>
        <a href="index.html#market">${icon('search')}<span>السوق</span></a>
        <a class="mobile-bottom-nav__add" href="product.html">${icon('plus')}<span>إعلان</span></a>
        <a href="dashboard.html">${icon('bell')}<span>صفقاتي</span></a>
        <a href="account.html">${icon('user')}<span>حسابي</span></a>
      </nav>`;
  }

  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-grid">
          <div class="footer-brand"><a class="brand brand--footer" href="index.html"><span class="brand__mark">${icon('shield')}<b>ض</b></span><span class="brand__text"><strong>ضمانك</strong><small>سوق آمن</small></span></a><p>صفقات أوضح، ومبلغ محفوظ لين يتم الاستلام والتأكيد.</p><div class="footer-warning">لا تحول أي مبلغ خارج المنصة.</div></div>
          <div><h3>المنصة</h3><ul><li><a href="index.html#market">السوق</a></li><li><a href="product.html">إضافة إعلان</a></li><li><a href="how-it-works.html">كيف تعمل؟</a></li><li><a href="index.html#calculator">حاسبة الرسوم</a></li></ul></div>
          <div><h3>الدعم</h3><ul><li><a href="faq.html">مركز المساعدة</a></li><li><a href="contact.html">تواصل معنا</a></li><li><a href="contact.html">فتح تذكرة</a></li><li><a href="contact.html">الإبلاغ عن إعلان</a></li></ul></div>
          <div><h3>قانوني</h3><ul><li><a href="about.html">من نحن</a></li><li><a href="faq.html">الشروط والأحكام</a></li><li><a href="faq.html">سياسة الخصوصية</a></li><li><a href="faq.html">سياسة النزاعات</a></li></ul></div>
        </div>
        <div class="container footer-bottom"><span>© 2026 ضمانك. جميع الحقوق محفوظة.</span><span>وسائل الدفع تظهر عند تفعيل الربط الفعلي.</span></div>
      </footer>`;
  }

  loadTheme();
  $('#themeToggle')?.addEventListener('click', toggleTheme);
  const drawer = $('#mobileDrawer');
  const backdrop = $('#drawerBackdrop');
  const toggle = $('#menuToggle');
  const setDrawer = open => {
    drawer?.classList.toggle('is-open', open); backdrop?.classList.toggle('is-open', open);
    drawer?.setAttribute('aria-hidden', String(!open)); toggle?.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
  };
  toggle?.addEventListener('click', () => setDrawer(true));
  $('#closeMenu')?.addEventListener('click', () => setDrawer(false));
  backdrop?.addEventListener('click', () => setDrawer(false));
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
  if (button) button.innerHTML = icon(document.documentElement.classList.contains('dark') ? 'sun' : 'moon');
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

  const syncSearch = value => { const input = $('#searchQuery'); if (input) input.value = value || ''; };
  $('.hero-search')?.addEventListener('submit', event => { event.preventDefault(); syncSearch($('#heroSearch')?.value); document.querySelector('#market')?.scrollIntoView({ behavior: 'smooth' }); loadProducts(); });
  $$('[data-search]').forEach(link => link.addEventListener('click', () => syncSearch(link.dataset.search)));
  $$('[data-category]').forEach(link => link.addEventListener('click', () => { const select = $('#categoryFilter'); if (select) select.value = link.dataset.category || ''; }));

  const productCard = product => `
    <article class="product-card">
      <a class="product-card__media" href="product.html?id=${encodeURIComponent(product.id)}">
        <img loading="lazy" src="${escapeHtml(product.image_url || 'assets/img/placeholder.svg')}" alt="${escapeHtml(product.title)}">
        ${product.seller?.nafath_verified ? '<span class="product-card__badge">موثق</span>' : ''}
        <span class="product-card__photos">1 صورة</span>
        <button class="product-card__favorite" type="button" aria-label="إضافة للمفضلة">${icon('shield')}</button>
      </a>
      <div class="product-card__body">
        <span class="product-card__category">${escapeHtml(product.category || 'عام')}</span>
        <a href="product.html?id=${encodeURIComponent(product.id)}"><h3>${escapeHtml(product.title)}</h3></a>
        <strong class="product-card__price">${money(product.price)}</strong>
        <div class="product-card__meta"><span>${escapeHtml(product.city || 'السعودية')}</span><span>أضيف مؤخراً</span></div>
        <div class="product-card__seller"><span>${product.seller?.nafath_verified ? 'حساب موثق' : 'التوثيق غير مكتمل'}</span></div>
        <a class="product-card__link" href="product.html?id=${encodeURIComponent(product.id)}">عرض التفاصيل <span>←</span></a>
      </div>
    </article>`;

  async function loadProducts() {
    grid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
    try {
      const params = new URLSearchParams(new FormData(form));
      [...params.entries()].forEach(([key, value]) => { if (!value) params.delete(key); });
      const rows = await api(`/products?${params.toString()}`);
      $('#resultsCount').textContent = rows.length ? `${rows.length} إعلان مطابق` : 'ما لقينا نتائج بنفس اختياراتك.';
      grid.innerHTML = rows.length ? rows.map(productCard).join('') : '<div class="empty-state"><span>'+icon('search')+'</span><h3>ما لقينا نتائج</h3><p>جرّب توسّع البحث شوي أو امسح الفلاتر.</p></div>';
    } catch (error) {
      $('#resultsCount').textContent = 'تعذر تحميل السوق';
      grid.innerHTML = `<div class="empty-state"><span>${icon('shield')}</span><h3>تعذر تحميل المنتجات</h3><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  form.addEventListener('submit', event => { event.preventDefault(); loadProducts(); });
  $('#clearFilters')?.addEventListener('click', () => { form.reset(); loadProducts(); });
  $$('[data-quick-filter]').forEach(button => button.addEventListener('click', () => { $$('[data-quick-filter]').forEach(x => x.classList.remove('is-active')); button.classList.add('is-active'); loadProducts(); }));
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
  // إذا لم يوجد id، نكون في صفحة إضافة الإعلان (النموذج موجود)، نخرج بدون تنفيذ
  if (!id) return;

  // باقي الكود لعرض تفاصيل المنتج
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
          body: JSON.stringify({ product_id: product.id, inspection_hours: product.inspection_hours || 24 })
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

// ========== دالة معالجة نموذج إضافة الإعلان ==========
function initProductForm() {
  const form = document.getElementById('createProductForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري النشر...';

    try {
      const tok = token();
      if (!tok) {
        toast('يرجى تسجيل الدخول أولاً', 'error');
        return;
      }

      const formData = new FormData(form);
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tok}` },
        body: formData
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'حدث خطأ أثناء النشر');

      toast('✅ تم نشر الإعلان بنجاح!', 'success');
      form.reset();
      const msgDiv = document.getElementById('resultMessage');
      if (msgDiv) {
        msgDiv.innerHTML = `<p style="color: #006c35; font-weight: 700;">✅ تم النشر! <a href="/product.html?id=${result.id}" target="_blank">عرض الإعلان</a></p>`;
      }
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}
// ==================================================

function init() {
  shell();
  initCalculator();
  home();
  initAuth();
  productPage();
  transactionPage();
  dashboardPage();
  loadNotifications();
  initProductForm(); // تفعيل معالج النموذج

  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { threshold: 0.12 });
  $$('.reveal, .section').forEach(el => observer.observe(el));
}

document.addEventListener('DOMContentLoaded', init);
