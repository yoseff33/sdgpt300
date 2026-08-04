// ===== استيراد api =====
import { api, token, money } from './api.js';

// ===== الهيدر والفوتر =====
async function loadHeaderFooter() {
  // يمكنك وضع HTML للهيدر والفوتر هنا أو جلبها من ملفات خارجية
  // لكن سنقوم ببنائهما ديناميكياً لتبسيط الأمور
  const headerHTML = `
    <header>
      <div class="brand">ضمانك</div>
      <nav>
        <a href="/index.html" class="active">الرئيسية</a>
        <a href="/dashboard.html">لوحة التحكم</a>
        <a href="/product.html">المنتجات</a>
        <a href="/how-it-works.html">كيف تعمل؟</a>
        <a href="/contact.html">تواصل</a>
        <button id="themeToggle" aria-label="تغيير الثيم">🌙</button>
      </nav>
    </header>
  `;

  const footerHTML = `
    <footer>
      <div><h4>ضمانك</h4><p>منصة الضمان الرقمي الأولى</p></div>
      <div><h4>روابط سريعة</h4><a href="/index.html">الرئيسية</a><br /><a href="/dashboard.html">المعاملات</a></div>
      <div><h4>تواصل</h4><a href="mailto:support@damanak.com">support@damanak.com</a></div>
      <small>© 2026 ضمانك. جميع الحقوق محفوظة</small>
    </footer>
  `;

  document.querySelector('[data-header]')?.replaceWith?.(document.createRange().createContextualFragment(headerHTML));
  document.querySelector('[data-footer]')?.replaceWith?.(document.createRange().createContextualFragment(footerHTML));

  // إضافة مستمع لزر الثيم بعد تحميل الهيدر
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
}

// ===== الثيم =====
function toggleTheme() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
  }
}

function loadTheme() {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }
  updateThemeIcon();
}

// ===== تهيئة عامة =====
document.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
  await loadHeaderFooter();
  // تنفيذ أي وظائف خاصة بالصفحة حسب وجود عناصر معينة
  initPage();
});

// ===== وظائف خاصة بالصفحات =====
function initPage() {
  // مثال: تحميل المعاملات في الصفحة الرئيسية
  if (document.getElementById('products')) {
    loadProducts();
  }
  if (document.getElementById('transaction')) {
    loadTransaction();
  }
  if (document.getElementById('dashboard')) {
    loadDashboard();
  }
  // إلخ...
}

// ===== دوال تحميل البيانات =====
async function loadProducts() {
  try {
    const data = await api('/products'); // افتراضي
    const container = document.getElementById('products');
    if (!container) return;
    if (data.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">لا توجد منتجات</p>';
      return;
    }
    container.innerHTML = data.map(p => `
      <div class="card">
        <img src="${p.image || 'https://placehold.co/300x180?text=منتج'}" alt="${p.title}">
        <h3>${p.title}</h3>
        <div class="price">${money(p.price)}</div>
        <div class="seller">${p.seller_name || 'بائع'}</div>
        <a href="/product.html?id=${p.id}" class="button small">تفاصيل</a>
      </div>
    `).join('');
  } catch (error) {
    console.error('فشل تحميل المنتجات:', error);
  }
}

async function loadTransaction() {
  // تنفيذ خاص بالصفحة
}

async function loadDashboard() {
  // تنفيذ خاص بالصفحة
}

// ===== تصدير بعض الدوال للاستخدام في الصفحات =====
export { api, token, money, loadProducts };
