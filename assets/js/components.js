export function shell() {
  document.querySelector('[data-header]').innerHTML = `
    <header>
      <a class="brand" href="index.html">ضمانك</a>
      <nav>
        <a href="index.html">السوق</a>
        <a href="how-it-works.html">كيف تعمل؟</a>
        <a href="dashboard.html">لوحتي</a>
        <a href="account.html">حسابي</a>
        <button id="theme">◐</button>
        <a class="bell" href="dashboard.html">🔔 <b id="badge">0</b></a>
      </nav>
    </header>
  `;

  document.querySelector('[data-footer]').innerHTML = `
    <footer>
      <div>
        <b>ضمانك</b>
        <p>سوق آمن بمعاملات ضمان مالي.</p>
      </div>
      <div>
        <a href="about.html">من نحن</a> · 
        <a href="faq.html">الأسئلة</a> · 
        <a href="contact.html">تواصل</a>
      </div>
      <small>متوافقة مع هيئة الأمن السيبراني · سحابة سعودية · التقديم للمظلة التجريبية للبنك المركزي لا يعني اعتمادًا حتى صدوره</small>
    </footer>
  `;

  document.querySelector('#theme')?.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
  });
}

