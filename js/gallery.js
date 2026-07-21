/* Галерея: работы из data/gallery.json (папки images/art/<Категория>/).
   «Все работы» — сеткой плиток; отдельная категория — coverflow.
   Серия открывается в лайтбоксе с любой части. BASE/REDUCED — из common.js. */

(function () {
  let all = [];
  let list = [];
  let current = 0;
  let filter = 'все';
  let usingA = true;
  let cooldown = false;

  const els = {};

  document.addEventListener('DOMContentLoaded', async () => {
    cache();
    bindEvents();
    setData(await loadData());
  });

  function cache() {
    els.page = document.querySelector('.gallery-page');
    els.filters = document.querySelector('[data-filters]');
    els.coverflow = document.querySelector('[data-coverflow]');
    els.grid = document.querySelector('[data-grid]');
    els.left = document.querySelector('.cf-side.left');
    els.right = document.querySelector('.cf-side.right');
    els.leftImg = els.left.querySelector('img');
    els.rightImg = els.right.querySelector('img');
    els.stack = document.querySelector('.cf-center .stack');
    els.layerA = document.querySelector('.layer.a');
    els.layerB = document.querySelector('.layer.b');
    els.info = document.querySelector('.art-info');
    els.counter = els.info.querySelector('.counter');
    els.title = els.info.querySelector('h2');
    els.meta = els.info.querySelector('.meta');
    els.strip = document.querySelector('[data-filmstrip] .filmstrip-inner') || document.querySelector('[data-filmstrip]');
    els.lb = document.querySelector('.lightbox');
    els.lbImg = els.lb.querySelector('.lb-image');
    els.lbCap = els.lb.querySelector('.lb-caption');
    els.lbText = els.lb.querySelector('.lb-text');
    els.lbMulti = els.lb.querySelector('.lb-multi');
  }

  async function loadData() {
    try {
      const r = await fetch(`${BASE}/data/gallery.json`, { cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch { /* нет файла */ }
    return { categories: [] };
  }

  function setData(data) {
    all = [];
    (data.categories || []).forEach((c) => {
      (c.works || []).forEach((w) => {
        all.push({
          title: w.title,
          category: c.id,
          categoryLabel: c.label || c.id,
          type: w.type === 'text' ? 'text' : 'art',
          group: !!w.group && (w.images || []).length > 1,
          images: (w.images || []).map((s) => `${BASE}/${s}`),
          info: w.info || '',
          body: w.body || '',
        });
      });
    });
    // buildFilters(data.categories || []);
    // applyFilter('все');
    const categories = data.categories || [];
    const firstCategory = categories.find((c) => (c.works || []).length)?.id || 'все';

    buildFilters(categories);
    applyFilter(firstCategory);
  }

  /* ---------- фильтры / режимы ---------- */
  function buildFilters(categories) {
    const cats = categories.filter((c) => (c.works || []).length);
    els.filters.innerHTML = '';
    [...cats, { id: 'все', label: 'Все работы' }].forEach((c) => {
      const b = document.createElement('button');
      b.className = 'chip' + (c.id === filter ? ' active' : '');
      b.textContent = c.label;
      b.dataset.cat = c.id;
      b.addEventListener('click', () => applyFilter(c.id));
      els.filters.appendChild(b);
    });
  }

  function applyFilter(cat) {
    filter = cat;
    list = cat === 'все' ? all.slice() : all.filter((w) => w.category === cat);
    current = 0;
    els.filters.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.cat === cat));

    const gridMode = cat === 'все';
    els.page.classList.toggle('grid-mode', gridMode);
    els.coverflow.hidden = gridMode;
    els.grid.hidden = !gridMode;
    if (gridMode) {
      buildGrid();
    } else {
      buildStrip();
      render(0);
    }
  }

  /* ---------- сетка «Все работы» ---------- */
  function buildGrid() {
    els.grid.innerHTML = '';
    const reveal = !REDUCED && 'IntersectionObserver' in window
      ? new IntersectionObserver((entries, obs) => {
          entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
        }, { rootMargin: '0px 0px -6% 0px' })
      : null;
    all.forEach((w, i) => {
      const fig = document.createElement('figure');
      fig.className = 'grid-card';
      const media = w.type === 'text'
        ? `<div class="grid-media text"><span>${w.title[0] || 'Т'}</span></div>`
        : `<div class="grid-media"><img src="${w.images[0]}" alt="${w.title}" loading="lazy">${w.group ? `<span class="grid-badge">${w.images.length}</span>` : ''}</div>`;
      fig.innerHTML = `${media}<figcaption><h3></h3><span class="cat">${w.categoryLabel}</span></figcaption>`;
      fig.querySelector('h3').textContent = w.title;
      fig.addEventListener('click', () => { current = i; openLightbox(); });
      els.grid.appendChild(fig);
      if (reveal) reveal.observe(fig); else fig.classList.add('in');
    });
  }

  function buildStrip() {
    els.strip.innerHTML = '';
    list.forEach((w, i) => {
      const b = document.createElement('button');
      b.className = 'thumb' + (w.type === 'text' ? ' text-thumb' : '');
      if (w.type === 'text') b.innerHTML = '<span>Т</span>';
      else b.innerHTML = `<img src="${w.images[0]}" alt="${w.title}" loading="lazy">`;
      if (w.group) b.insertAdjacentHTML('beforeend', `<span class="thumb-badge">${w.images.length}</span>`);
      b.addEventListener('click', () => go(i));
      els.strip.appendChild(b);
    });
  }

  /* ---------- центр coverflow ---------- */
  function fillLayer(layer, w) {
    layer.classList.remove('multi', 'single', 'text');
    layer.innerHTML = '';
    if (w.type === 'text') {
      layer.classList.add('text');
      const card = document.createElement('div');
      card.className = 'text-card';
      const preview = w.body.length > 320 ? w.body.slice(0, 320).trim() + '…' : w.body;
      card.innerHTML = `<h3></h3><p></p><span class="read">Читать</span>`;
      card.querySelector('h3').textContent = w.title;
      card.querySelector('p').textContent = preview;
      layer.appendChild(card);
      return;
    }
    const n = w.images.length;
    layer.classList.add(n > 1 ? 'multi' : 'single');
    w.images.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.alt = w.title;
      if (n > 1) {
        img.style.maxWidth = `calc((min(88vw, 1120px) - ${n - 1} * 1.2rem) / ${n})`;
        // клик по любой части серии — открыть работу целиком (все части)
        img.addEventListener('click', (e) => { e.stopPropagation(); openLightbox(); });
      }
      layer.appendChild(img);
    });
  }

  function setSide(sideEl, imgEl, w) {
    if (w.type === 'text') {
      sideEl.classList.add('is-text');
      sideEl.dataset.label = w.title;
      imgEl.removeAttribute('src');
    } else {
      sideEl.classList.remove('is-text');
      imgEl.src = w.images[0];
      imgEl.alt = w.title;
    }
  }

  function metaHtml(w) {
    const bits = [w.categoryLabel];
    if (w.group) bits.push(`серия · ${w.images.length} ${plural(w.images.length)}`);
    if (w.info) bits.push(w.info);
    return bits.map((b) => `<span>${b}</span>`).join(' <span class="dot">·</span> ');
  }
  function plural(n) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'часть';
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'части';
    return 'частей';
  }

  function render(dir) {
    const n = list.length;
    if (!n) { els.title.textContent = 'Здесь пока нет работ'; els.meta.innerHTML = ''; els.counter.textContent = '—'; return; }
    const w = list[current];
    const prev = list[(current - 1 + n) % n];
    const next = list[(current + 1) % n];

    setSide(els.left, els.leftImg, prev);
    setSide(els.right, els.rightImg, next);
    els.left.style.display = n > 1 ? '' : 'none';
    els.right.style.display = n > 1 ? '' : 'none';

    const showEl = usingA ? els.layerB : els.layerA;
    const hideEl = usingA ? els.layerA : els.layerB;
    fillLayer(showEl, w);
    els.stack.classList.toggle('is-group', w.group);
    els.stack.classList.toggle('is-text', w.type === 'text');

    showEl.classList.remove('enter-left', 'enter-right');
    if (dir === 1) showEl.classList.add('enter-right');
    else if (dir === -1) showEl.classList.add('enter-left');
    requestAnimationFrame(() => {
      showEl.classList.add('show');
      showEl.classList.remove('enter-left', 'enter-right');
      hideEl.classList.remove('show');
    });
    usingA = !usingA;

    els.counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
    els.title.textContent = w.title;
    els.meta.innerHTML = metaHtml(w);
    els.info.classList.remove('swap'); void els.info.offsetWidth; els.info.classList.add('swap');

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
  function guard() { if (cooldown) return false; cooldown = true; setTimeout(() => (cooldown = false), 260); return true; }

  /* ---------- события ---------- */
  function bindEvents() {
    els.left.addEventListener('click', prev);
    els.right.addEventListener('click', next);
    document.querySelector('.nav-arrow.prev').addEventListener('click', prev);
    document.querySelector('.nav-arrow.next').addEventListener('click', next);
    document.querySelector('.cf-center').addEventListener('click', () => openLightbox());

    document.addEventListener('keydown', (e) => {
      if (els.lb.classList.contains('open')) {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') lbStep(-1);
        else if (e.key === 'ArrowRight') lbStep(1);
        return;
      }
      if (filter === 'все') return;
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    });

    let wheelLock = false;
    document.querySelector('.stage').addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return;
      e.preventDefault();
      if (wheelLock) return;
      wheelLock = true; setTimeout(() => (wheelLock = false), 420);
      (e.deltaY > 0 || e.deltaX > 0) ? next() : prev();
    }, { passive: false });

    let sx = 0;
    const stage = document.querySelector('.stage');
    stage.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
    stage.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 45) (dx < 0 ? next() : prev());
    }, { passive: true });

    els.lb.querySelector('.lb-x').addEventListener('click', closeLightbox);
    els.lb.querySelector('.lb-prev').addEventListener('click', (e) => { e.stopPropagation(); lbStep(-1); });
    els.lb.querySelector('.lb-next').addEventListener('click', (e) => { e.stopPropagation(); lbStep(1); });
    els.lb.addEventListener('click', (e) => { if (e.target === els.lb || e.target === els.lbImg) closeLightbox(); });
  }

  /* ---------- лайтбокс ---------- */
  function activeList() { return filter === 'все' ? all : list; }
  function openLightbox() {
    const src = activeList();
    if (!src.length || !src[current]) return;
    fillLightbox();
    els.lb.classList.add('show');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => els.lb.classList.add('open'));
  }
  function fillLightbox() {
    const src = activeList();
    const w = src[current];
    // сброс всех режимов
    els.lbImg.style.display = 'none';
    els.lbText.style.display = 'none';
    els.lbMulti.style.display = 'none';
    els.lbMulti.innerHTML = '';
    els.lb.classList.toggle('has-nav', src.length > 1);
    els.lb.classList.toggle('is-text', w.type === 'text');
    els.lb.classList.remove('is-group');

    if (w.type === 'text') {
      els.lbText.style.display = '';
      els.lbText.innerHTML = '';
      const h = document.createElement('h3'); h.textContent = w.title; els.lbText.appendChild(h);
      w.body.split(/\n\s*\n/).filter(Boolean).forEach((par) => {
        const p = document.createElement('p'); p.textContent = par; els.lbText.appendChild(p);
      });
      els.lbCap.textContent = w.categoryLabel;
      return;
    }

    if (w.images.length > 1) {
      // серия — показываем все части сразу
      els.lb.classList.add('is-group');
      els.lbMulti.style.display = 'flex';
      w.images.forEach((s) => {
        const img = new Image();
        img.src = s; img.alt = w.title;
        els.lbMulti.appendChild(img);
      });
      els.lbCap.textContent = (w.info ? `${w.title} — ${w.info}` : w.title) + ` · ${w.images.length} ${plural(w.images.length)}`;
      return;
    }

    // одиночная работа
    els.lbImg.style.display = '';
    els.lbImg.src = w.images[0];
    els.lbImg.alt = w.title;
    els.lbCap.textContent = w.info ? `${w.title} — ${w.info}` : w.title;
  }
  function lbStep(d) {
    const src = activeList();
    if (src.length < 2) return;
    current = (current + d + src.length) % src.length;
    els.lbMulti.scrollTop = 0;
    fillLightbox();
    // держим coverflow «под» лайтбоксом синхронным
    if (filter !== 'все') render(d);
  }
  function closeLightbox() {
    els.lb.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => els.lb.classList.remove('show'), 350);
  }
})();
