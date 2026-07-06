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

/* ---- переиспользуемый лайтбокс для фотографий ---- */
function makePhotoLightbox() {
  const lb = document.createElement('div');
  lb.className = 'photobox';
  lb.innerHTML = `
    <button class="pb-x" aria-label="Закрыть">✕</button>
    <button class="pb-prev" aria-label="Предыдущая">←</button>
    <button class="pb-next" aria-label="Следующая">→</button>
    <img alt="">
    <p class="pb-cap"></p>`;
  document.body.appendChild(lb);
  const imgEl = lb.querySelector('img');
  const cap = lb.querySelector('.pb-cap');
  let imgs = [], idx = 0, title = '';
  const fill = () => { imgEl.src = imgs[idx]; cap.textContent = imgs.length > 1 ? `${title} · ${idx + 1}/${imgs.length}` : title; };
  const step = (d) => { if (imgs.length < 2) return; idx = (idx + d + imgs.length) % imgs.length; fill(); };
  const close = () => { lb.classList.remove('open'); document.body.style.overflow = ''; setTimeout(() => lb.classList.remove('show'), 320); };
  lb.querySelector('.pb-x').addEventListener('click', close);
  lb.querySelector('.pb-prev').addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
  lb.querySelector('.pb-next').addEventListener('click', (e) => { e.stopPropagation(); step(1); });
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target === imgEl) close(); });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });
  return (images, start, t) => {
    imgs = images; idx = start || 0; title = t || '';
    lb.classList.toggle('single', imgs.length < 2);
    fill();
    lb.classList.add('show');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => lb.classList.add('open'));
  };
}
let _openPhotos;
function openPhotos(images, index, title) {
  if (!_openPhotos) _openPhotos = makePhotoLightbox();
  _openPhotos(images, index, title);
}

/* ---- иконки соцсетей ---- */
const SOCIAL_ICONS = {
  vk: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.2 17c-5.3 0-8.7-3.7-8.9-9.8h2.7c.1 4.5 2.1 6.3 3.6 6.7V7.2h2.5v3.8c1.5-.2 3-1.8 3.6-3.8h2.5c-.4 2.4-2 4-3.2 4.7 1.1.6 3 2 3.7 4.4h-2.8c-.6-1.7-2-3-3.8-3.2V17z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 5.2 18.8 19c-.2 1-.9 1.2-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.7-7.9c.4-.3-.1-.5-.6-.2L6.7 12.9l-4.6-1.5c-1-.3-1-1 .2-1.5l17.9-6.9c.8-.3 1.5.2 1.2 1.2z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.6 6.6 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.4 0-.5l-.7-1.7c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3c-.3.3-.9.9-.9 2.1s.9 2.4 1.1 2.6 1.8 2.8 4.3 3.9c1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1s.2-1 .1-1.1z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.6V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.3H7.5V13h2.8v8z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 8.2c-.2-1-.8-1.7-1.8-2C18.4 5.8 12 5.8 12 5.8s-6.4 0-8.2.4c-1 .3-1.6 1-1.8 2C1.6 10 1.6 12 1.6 12s0 2 .4 3.8c.2 1 .8 1.7 1.8 2 1.8.4 8.2.4 8.2.4s6.4 0 8.2-.4c1-.3 1.6-1 1.8-2 .4-1.8.4-3.8.4-3.8s0-2-.4-3.8zM10 15.3V8.7l5.3 3.3z"/></svg>',
};
function socialKey(label) {
  const l = (label || '').toLowerCase();
  if (/вк|vk|вконтакт/.test(l)) return 'vk';
  if (/telegram|телеграм|тг/.test(l)) return 'telegram';
  if (/whats|ватсап|вотсап/.test(l)) return 'whatsapp';
  if (/insta|инстаг/.test(l)) return 'instagram';
  if (/face|фейсбук/.test(l)) return 'facebook';
  if (/youtube|ютуб/.test(l)) return 'youtube';
  return null;
}
function socialButton(s) {
  const k = socialKey(s.label);
  const icon = k ? SOCIAL_ICONS[k] : '';
  return `<a class="social-btn${icon ? '' : ' is-text'}" href="${s.url}" target="_blank" rel="noopener" aria-label="${s.label}" title="${s.label}">${icon || s.label}</a>`;
}

/* ---- конфиг сайта (контакты, соцсети) из data/site.json ---- */
function loadSiteConfig() {
  return fetch(`${BASE}/data/site.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((site) => {
      if (!site) return;
      window.SITE = site;
      const socials = (site.socials || []).filter((s) => s.url);
      document.querySelectorAll('.site-footer').forEach((footer) => {
        if (footer.querySelector('.footer-socials') || footer.querySelector('.social-buttons')) return;
        const anchor = footer.querySelector('.footer-links') || footer.querySelector('.footer-name');
        // контакты (текст)
        const contact = [];
        if (site.email) contact.push(`<a href="mailto:${site.email}">${site.email}</a>`);
        if (site.phone) contact.push(`<a href="tel:${site.phone.replace(/[^+\d]/g, '')}">${site.phone}</a>`);
        if (contact.length && anchor) {
          const block = document.createElement('div');
          block.className = 'footer-socials';
          block.innerHTML = contact.join('');
          anchor.insertAdjacentElement('afterend', block);
        }
        // соцсети (кнопки-иконки)
        if (socials.length && anchor) {
          const row = document.createElement('div');
          row.className = 'social-buttons';
          row.innerHTML = socials.map(socialButton).join('');
          (footer.querySelector('.footer-socials') || anchor).insertAdjacentElement('afterend', row);
        }
      });

      // Контакты на странице «Художник»
      const setContact = (sel, cond, fill) => {
        const el = document.querySelector(sel);
        if (el && cond) { fill(el); el.hidden = false; }
      };
      setContact('[data-contact-email]', site.email, (el) => {
        const a = el.querySelector('a'); a.href = `mailto:${site.email}`; a.textContent = site.email;
      });
      setContact('[data-contact-phone]', site.phone, (el) => {
        const a = el.querySelector('a'); a.href = `tel:${site.phone.replace(/[^+\d]/g, '')}`; a.textContent = site.phone;
      });
      setContact('[data-contact-location]', site.location, (el) => {
        el.querySelector('span').textContent = site.location;
      });
      const socBox = document.querySelector('[data-contact-socials]');
      if (socBox && socials.length) {
        socBox.className = 'social-buttons';
        socBox.innerHTML = socials.map(socialButton).join('');
      }
      setContact('[data-subscribe]', site.email, (el) => {
        const a = el.querySelector('a');
        const note = site.subscribeNote || 'Написать';
        a.href = `mailto:${site.email}?subject=${encodeURIComponent(note)}`;
        const noteEl = a.querySelector('[data-subscribe-note]');
        if (noteEl) noteEl.textContent = note;
      });

      document.dispatchEvent(new CustomEvent('siteconfig', { detail: site }));
    })
    .catch(() => {});
}

/* авто-старт общих вещей */
document.addEventListener('DOMContentLoaded', () => {
  const navPath = IN_PAGES ? 'navbar.html' : 'pages/navbar.html';
  initNavbar(navPath).then(initReveals);
  initReveals();
  loadSiteConfig();
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
