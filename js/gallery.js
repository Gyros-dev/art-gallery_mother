/* Галерея: coverflow, фильтры, лента миниатюр, лайтбокс.
   BASE/REDUCED объявлены в common.js (подключается раньше). */

(function () {
  let all = [];      // все работы
  let list = [];     // отфильтрованные
  let current = 0;
  let filter = 'все';
  let usingA = true; // какой слой сейчас показан
  let cooldown = false;

  const els = {};

  document.addEventListener('DOMContentLoaded', () => {
    cache();
    fetch(`${BASE}/data/images.json`)
      .then((r) => r.json())
      .then((data) => {
        all = data.map((d) => ({ ...d, src: `${BASE}/${d.src}` }));
        buildFilters();
        applyFilter('все');
        bindEvents();
      });
  });

  function cache() {
    els.filters = document.querySelector('[data-filters]');
    els.left = document.querySelector('.cf-side.left');
    els.right = document.querySelector('.cf-side.right');
    els.leftImg = els.left.querySelector('img');
    els.rightImg = els.right.querySelector('img');
    els.layerA = document.querySelector('.layer.a');
    els.layerB = document.querySelector('.layer.b');
    els.imgA = els.layerA.querySelector('img');
    els.imgB = els.layerB.querySelector('img');
    els.shuttle = document.querySelector('.shuttle');
    els.info = document.querySelector('.art-info');
    els.counter = els.info.querySelector('.counter');
    els.title = els.info.querySelector('h2');
    els.meta = els.info.querySelector('.meta');
    els.strip = document.querySelector('[data-filmstrip] .filmstrip-inner') || document.querySelector('[data-filmstrip]');
    els.lb = document.querySelector('.lightbox');
    els.lbImg = els.lb.querySelector('img');
    els.lbCap = els.lb.querySelector('.lb-caption');
  }

  function buildFilters() {
    const cats = ['все', ...Array.from(new Set(all.map((a) => a.category)))];
    els.filters.innerHTML = '';
    cats.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'chip' + (c === 'все' ? ' active' : '');
      b.textContent = c === 'все' ? 'Все работы' : c[0].toUpperCase() + c.slice(1);
      b.dataset.cat = c;
      b.addEventListener('click', () => applyFilter(c));
      els.filters.appendChild(b);
    });
  }

  function applyFilter(cat) {
    filter = cat;
    list = cat === 'все' ? all.slice() : all.filter((a) => a.category === cat);
    current = 0;
    els.filters.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.cat === cat));
    buildStrip();
    render(0);
  }

  function buildStrip() {
    els.strip.innerHTML = '';
    list.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'thumb';
      b.innerHTML = `<img src="${it.src}" alt="${it.title}" loading="lazy">`;
      b.addEventListener('click', () => go(i));
      els.strip.appendChild(b);
    });
  }

  function metaHtml(it) {
    const parts = [it.year, it.material, it.size, it.location].filter(Boolean);
    return parts.map((p) => `<span>${p}</span>`).join(' <span class="dot">·</span> ');
  }

  function render(dir) {
    const n = list.length;
    if (!n) return;
    const it = list[current];
    const prev = list[(current - 1 + n) % n];
    const next = list[(current + 1) % n];

    // боковые
    els.leftImg.src = prev.src; els.leftImg.alt = prev.title;
    els.rightImg.src = next.src; els.rightImg.alt = next.title;
    els.left.style.display = n > 1 ? '' : 'none';
    els.right.style.display = n > 1 ? '' : 'none';

    // центр — переключаем слои крест-накрест
    const showEl = usingA ? els.layerB : els.layerA;
    const showImg = usingA ? els.imgB : els.imgA;
    const hideEl = usingA ? els.layerA : els.layerB;
    showImg.src = it.src; showImg.alt = it.title;

    showEl.classList.remove('enter-left', 'enter-right');
    if (dir === 1) showEl.classList.add('enter-right');
    else if (dir === -1) showEl.classList.add('enter-left');

    requestAnimationFrame(() => {
      showEl.classList.add('show');
      showEl.classList.remove('enter-left', 'enter-right');
      hideEl.classList.remove('show');
    });
    usingA = !usingA;

    // челнок
    if (!REDUCED && dir) {
      els.shuttle.classList.remove('run');
      void els.shuttle.offsetWidth;
      els.shuttle.classList.add('run');
    }

    // инфо
    els.counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
    els.title.textContent = it.title;
    els.meta.innerHTML = metaHtml(it);
    els.info.classList.remove('swap'); void els.info.offsetWidth; els.info.classList.add('swap');

    // миниатюры
    els.strip.querySelectorAll('.thumb').forEach((t, i) => {
      t.classList.toggle('active', i === current);
      if (i === current) t.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    });
  }

  function go(index) {
    const n = list.length;
    if (!n || index === current) return;
    const dir = index > current ? 1 : -1;
    current = (index + n) % n;
    render(dir);
  }
  function next() { if (guard()) go((current + 1) % list.length); }
  function prev() { if (guard()) go((current - 1 + list.length) % list.length); }
  function guard() {
    if (cooldown) return false;
    cooldown = true; setTimeout(() => (cooldown = false), 260); return true;
  }

  function bindEvents() {
    els.left.addEventListener('click', prev);
    els.right.addEventListener('click', next);
    document.querySelector('.nav-arrow.prev').addEventListener('click', prev);
    document.querySelector('.nav-arrow.next').addEventListener('click', next);
    document.querySelector('.cf-center').addEventListener('click', openLightbox);

    document.addEventListener('keydown', (e) => {
      if (els.lb.classList.contains('open')) {
        if (e.key === 'Escape') closeLightbox();
        return;
      }
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    });

    // колесо
    let wheelLock = false;
    document.querySelector('.stage').addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return;
      e.preventDefault();
      if (wheelLock) return;
      wheelLock = true; setTimeout(() => (wheelLock = false), 420);
      (e.deltaY > 0 || e.deltaX > 0) ? next() : prev();
    }, { passive: false });

    // свайп
    let sx = 0;
    const stage = document.querySelector('.stage');
    stage.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
    stage.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 45) (dx < 0 ? next() : prev());
    }, { passive: true });

    // лайтбокс
    els.lb.querySelector('.lb-x').addEventListener('click', closeLightbox);
    els.lb.addEventListener('click', (e) => { if (e.target === els.lb || e.target === els.lbImg) closeLightbox(); });
  }

  function openLightbox() {
    const it = list[current];
    els.lbImg.src = it.src; els.lbImg.alt = it.title;
    els.lbCap.textContent = `${it.title} · ${it.year}`;
    els.lb.classList.add('show');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => els.lb.classList.add('open'));
  }
  function closeLightbox() {
    els.lb.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => els.lb.classList.remove('show'), 350);
  }
})();
