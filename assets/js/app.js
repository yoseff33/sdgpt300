// ===== استيراد api والمكتبات =====
import { api, money, token } from './api.js';

// ===== دوال مساعدة =====
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ===== حالة المعاملات =====
const statusMap = {
  pending_payment: 'بانتظار الدفع',
  funds_held: 'المبلغ محفوظ',
  shipped: 'تم التسليم',
  completed: 'مكتملة',
  disputed: 'نزاع مفتوح',
  cancelled: 'ملغاة'
};

// ===== إنشاء الهيدر والفوتر =====
function shell() {
  // بناء الهيدر مع مسارات نسبية
  const headerHTML = `
    <header>
      <div class="brand">ضمانك</div>
      <nav>
        <a href="index.html">الرئيسية</a>
        <a href="dashboard.html">لوحة التحكم</a>
        <a href="product.html">المنتجات</a>
        <a href="how-it-works.html">كيف تعمل؟</a>
        <a href="contact.html">تواصل</a>
        <span class="bell" id="bell">
          🔔
          <span class="badge" id="badge">0</span>
        </span>
        <button id="themeToggle" aria-label="تغيير الثيم">🌙</button>
      </nav>
    </header>
  `;

  // بناء الفوتر مع مسارات نسبية
  const footerHTML = `
    <footer>
      <div><h4>ضمانك</h4><p>منصة الضمان الرقمي الأولى</p></div>
      <div><h4>روابط سريعة</h4><a href="index.html">الرئيسية</a><br /><a href="dashboard.html">المعاملات</a></div>
      <div><h4>تواصل</h4><a href="mailto:support@damanak.com">support@damanak.com</a></div>
      <small>© 2026 ضمانك. جميع الحقوق محفوظة</small>
    </footer>
  `;

  const headerContainer = document.querySelector('[data-header]');
  const footerContainer = document.querySelector('[data-footer]');
  if (headerContainer) {
    headerContainer.innerHTML = headerHTML;
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.addEventListener('click', toggleTheme);
    }
  }
  if (footerContainer) {
    footerContainer.innerHTML = footerHTML;
  }

  loadTheme();
}

// ===== إدارة الثيم =====
function toggleTheme() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  updateThemeIcon();
}

function loadTheme() {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
  }
}

// ===== الصفحة الرئيسية (عرض المنتجات) =====
async function home() {
  const grid = $('#products');
  if (!grid) return;

  async function loadProducts() {
    try {
      const params = new URLSearchParams(new FormData($('#filters')));
      const rows = await api(`/products?${params}`);
      if (rows.length) {
        grid.innerHTML = rows.map(p => `
          <article class="card">
            <img src="${p.image_url || 'assets/img/placeholder.svg'}" alt="${p.title}">
            <span class="tag">${p.category || ''}</span>
            <h3>${p.title}</h3>
            <p>${p.description || ''}</p>
            <b>${money(p.price)}</b>
            <a class="button" href="product.html?id=${p.id}">عرض المنتج</a>
          </article>
        `).join('');
      } else {
        grid.innerHTML = '<p>لا توجد نتائج.</p>';
      }
    } catch (e) {
      grid.innerHTML = `<p class="error">${e.message}</p>`;
    }
  }

  const filterForm = $('#filters');
  if (filterForm) {
    filterForm.addEventListener('submit', e => {
      e.preventDefault();
      loadProducts();
    });
  }
  loadProducts();
}

// ===== نموذج الدخول / التسجيل =====
function initAuth() {
  const form = $('#auth');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      const data = await api(`/auth/${fd.mode}`, { method: 'POST', body: JSON.stringify(fd) });
      if (fd.mode === 'signup') {
        $('#msg').textContent = 'تم إنشاء الحساب. تحقق من بريدك ثم سجل الدخول.';
      } else {
        localStorage.setItem('damanak_token', data.session.access_token);
        location.href = 'dashboard.html';
      }
    } catch (x) {
      $('#msg').textContent = x.message;
    }
  });
}

// ===== صفحة المنتج =====
async function productPage() {
  const container = $('#product');
  if (!container) return;
  try {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) {
      container.textContent = 'لم يتم تحديد المنتج';
      return;
    }
    const p = await api(`/products/${id}`);
    container.innerHTML = `
      <img src="${p.image_url || 'assets/img/placeholder.svg'}" alt="${p.title}">
      <section>
        <span class="tag">${p.category || ''}</span>
        <h1>${p.title}</h1>
        <p>${p.description || ''}</p>
        <h2>${money(p.price)}</h2>
        <p>فترة الفحص: ${p.inspection_hours || 24} ساعة · البائع ${p.seller?.nafath_verified ? 'موثق ✓' : 'غير موثق'}</p>
        <button id="buy">شراء بضمان</button>
      </section>
    `;
    const buyBtn = $('#buy');
    if (buyBtn) {
      buyBtn.onclick = async () => {
        if (!token()) {
          location.href = 'login.html';
          return;
        }
        try {
          const tx = await api('/transactions', {
            method: 'POST',
            body: JSON.stringify({
              product_id: p.id,
              seller_id: p.seller_id,
              amount: p.price,
              inspection_hours: p.inspection_hours || 24
            })
          });
          location.href = `transaction.html?id=${tx.id}`;
        } catch (e) {
          alert(e.message);
        }
      };
    }
  } catch (e) {
    container.textContent = e.message;
  }
}

// ===== صفحة المعاملة =====
async function transactionPage() {
  const container = $('#transaction');
  if (!container) return;
  try {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) {
      container.textContent = 'لم يتم تحديد المعاملة';
      return;
    }
    const t = await api(`/transactions/${id}`);
    container.innerHTML = `
      <div class="card">
        <span class="status ${t.status}">${statusMap[t.status] || t.status}</span>
        <h1>${t.product?.title || 'معاملة مباشرة'}</h1>
        <h2>${money(t.amount)}</h2>
        <p>${t.description || ''}</p>
        <p>العمولة: ${money(t.commission)}</p>
        ${t.inspection_deadline ? `<p data-deadline="${t.inspection_deadline}"></p>` : ''}
        <div class="actions">
          ${t.status === 'pending_payment' ? `
            <button data-pay="moyasar">مدى / فيزا</button>
            <button data-pay="tabby">تابي</button>
            <button data-pay="tamara">تمارا</button>
          ` : ''}
          ${t.status === 'funds_held' ? '<button id="ship">تأكيد التسليم</button>' : ''}
          ${t.status === 'shipped' ? '<button id="receive">تأكيد الاستلام</button>' : ''}
          ${['funds_held', 'shipped'].includes(t.status) ? '<button class="danger" id="dispute">فتح نزاع</button>' : ''}
          <button id="share">نسخ رابط المشاركة</button>
        </div>
      </div>
    `;

    $$('[data-pay]').forEach(btn => {
      btn.onclick = async () => {
        try {
          const x = await api('/payments/create-session', {
            method: 'POST',
            body: JSON.stringify({ transactionId: id, method: btn.dataset.pay })
          });
          location.href = x.redirect_url;
        } catch (e) {
          alert(e.message);
        }
      };
    });

    const shipBtn = $('#ship');
    if (shipBtn) {
      shipBtn.onclick = () => act('ship');
    }

    const receiveBtn = $('#receive');
    if (receiveBtn) {
      receiveBtn.onclick = () => act('confirm-receipt');
    }

    const disputeBtn = $('#dispute');
    if (disputeBtn) {
      disputeBtn.onclick = async () => {
        const reason = prompt('سبب النزاع');
        if (reason) {
          await api(`/transactions/${id}/raise-dispute`, {
            method: 'PUT',
            body: JSON.stringify({ reason, description: reason })
          });
          location.reload();
        }
      };
    }

    const shareBtn = $('#share');
    if (shareBtn) {
      shareBtn.onclick = () => navigator.clipboard.writeText(location.href);
    }

    const deadlineEl = document.querySelector('[data-deadline]');
    if (deadlineEl) {
      setInterval(() => {
        const remaining = Math.max(0, Math.floor((new Date(deadlineEl.dataset.deadline) - Date.now()) / 1000));
        deadlineEl.textContent = `الوقت المتبقي: ${remaining} ثانية`;
      }, 1000);
    }

    async function act(action) {
      try {
        await api(`/transactions/${id}/${action}`, { method: 'PUT' });
        location.reload();
      } catch (e) {
        alert(e.message);
      }
    }
  } catch (e) {
    container.textContent = e.message;
  }
}

// ===== لوحة التحكم =====
async function dashboardPage() {
  const container = $('#dashboard');
  if (!container) return;
  try {
    const rows = await api('/transactions');
    container.innerHTML = `
      <h1>لوحة التحكم</h1>
      <div class="stats">
        <div class="card">
          <small>المعاملات</small>
          <strong>${rows.length}</strong>
        </div>
        <div class="card">
          <small>المبالغ</small>
          <strong>${money(rows.reduce((s, x) => s + Number(x.amount), 0))}</strong>
        </div>
      </div>
      <div class="panel">
        <h2>معاملاتي</h2>
        ${rows.length ? rows.map(x => `
          <a class="row" href="transaction.html?id=${x.id}">
            <span>${x.product?.title || 'معاملة مباشرة'}</span>
            <b>${money(x.amount)}</b>
            <em>${statusMap[x.status] || x.status}</em>
          </a>
        `).join('') : '<p>لا توجد معاملات</p>'}
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<p class="error">${e.message}</p><a class="button" href="login.html">تسجيل الدخول</a>`;
  }
}

// ===== الإشعارات =====
async function loadNotifications() {
  if (!token()) return;
  try {
    const notifs = await api('/notifications');
    const badge = $('#badge');
    if (badge) {
      const unread = notifs.filter(n => !n.read).length;
      badge.textContent = unread > 0 ? unread : '0';
    }
  } catch (e) {
    console.error('فشل تحميل الإشعارات', e);
  }
}

// ===== تهيئة الصفحة =====
function init() {
  shell();
  home();
  initAuth();
  productPage();
  transactionPage();
  dashboardPage();
  loadNotifications();
}

document.addEventListener('DOMContentLoaded', init);
