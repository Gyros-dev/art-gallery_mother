/* Общий модуль: навбар, зерно, появления, канвас-«станок».
   Работает и на index.html (корень), и на страницах в pages/. */

const IN_PAGES = location.pathname.includes('/pages/');
const BASE = IN_PAGES ? '..' : '.';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- зерно ---- */
(function grain() {
  const g = document.createElement('div');
  g.className = 'grain';
  g.setAttribute('aria-hidden', 'true');
  document.body.appendChild(g);
})();

/* ---- навбар ---- */
function initNavbar(navHtmlPath) {
  const holder = document.getElementById('navbar-placeholder');
  if (!holder) return Promise.resolve();
  return fetch(navHtmlPath)
    .then((r) => r.text())
    .then((html) => {
      holder.innerHTML = html;
      const nav = holder.querySelector('.navbar');
      const links = holder.querySelectorAll('.nav-links a');
      const home = holder.querySelector('[data-home]');

      // Пути: из корня добавляем префикс pages/
      if (!IN_PAGES) {
        links.forEach((a) => (a.href = 'pages/' + a.getAttribute('href')));
        if (home) home.setAttribute('href', 'pages/gallery.html');
      }

      // Активная ссылка
      const current = location.pathname.split('/').pop() || 'index.html';
      links.forEach((a) => {
        if (a.getAttribute('href').endsWith(current) && current !== 'index.html') {
          a.classList.add('active');
        }
      });

      // Бургер-меню
      const toggle = holder.querySelector('.nav-toggle');
      toggle?.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      links.forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));

      // Скрытие при скролле вниз
      let last = 0;
      addEventListener('scroll', () => {
        const y = scrollY;
        if (y > last && y > 200) nav.classList.add('nav-hidden');
        else nav.classList.remove('nav-hidden');
        last = y;
      }, { passive: true });
    })
    .catch(() => {});
}

/* ---- появления при скролле ---- */
function initReveals() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (REDUCED) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
}

/* ---- канвас-«ткацкий станок» ----
   вертикальные нити основы + горизонтальные нити утка, которые
   «проткываются» слева направо с челноком на конце. */
function initLoom(canvas) {
  if (!canvas || REDUCED) return;
  const ctx = canvas.getContext('2d');
  let w, h, dpr, threads = [], t = 0;
  const palette = ['#1f3a4d', '#2f6d7e', '#b0512b', '#c1934a', '#7a6a52'];

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rows = Math.max(12, Math.floor(h / 46));
    threads = Array.from({ length: rows }, (_, i) => ({
      y: (h / rows) * (i + 0.5),
      speed: 0.4 + Math.random() * 0.6,
      amp: 4 + Math.random() * 11,
      phase: Math.random() * Math.PI * 2,
      color: palette[i % palette.length],
      progress: -Math.random() * 1.5,
    }));
  }

  function frame() {
    t += 0.008;
    ctx.clearRect(0, 0, w, h);

    // основа
    ctx.strokeStyle = 'rgba(33,28,23,0.05)';
    ctx.lineWidth = 1;
    const cols = Math.floor(w / 44);
    for (let i = 0; i <= cols; i++) {
      const x = (w / cols) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    // уток
    for (const th of threads) {
      th.progress += 0.0024 * th.speed;
      if (th.progress > 1.7) th.progress = -0.4;
      const reach = Math.min(Math.max(th.progress, 0), 1) * w;
      if (reach <= 0) continue;
      ctx.strokeStyle = th.color;
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= reach; x += 6) {
        const y = th.y + Math.sin(x * 0.02 + t * 2 + th.phase) * th.amp;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      // челнок
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = th.color;
      const yEnd = th.y + Math.sin(reach * 0.02 + t * 2 + th.phase) * th.amp;
      ctx.beginPath(); ctx.arc(reach, yEnd, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }
  resize();
  addEventListener('resize', resize);
  frame();
}

/* авто-старт общих вещей */
document.addEventListener('DOMContentLoaded', () => {
  const navPath = IN_PAGES ? 'navbar.html' : 'pages/navbar.html';
  initNavbar(navPath).then(initReveals);
  initReveals();
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
