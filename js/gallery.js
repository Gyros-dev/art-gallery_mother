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
  let lbSlides = []; // плоский список: каждая часть серии = отдельный слайд
  let lbIndex = 0;

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
          layout: w.layout === 'grid' ? 'grid' : 'row',
          parts: w.parts || [],
          images: (w.images || []).map((s) => `${BASE}/${s}`),
          thumb: w.thumb ? `${BASE}/${w.thumb}` : ((w.images || [])[0] ? `${BASE}/${w.images[0]}` : ''),
          info: w.info || '',
          body: w.body || '',
        });
      });
    });
    const categories = data.categories || [];
    const firstCategory = categories.find((c) => (c.works || []).length)?.id || 'все';

    buildFilters(categories);

    // deep-link с главной: ?cat=<id|все>&work=<название>
    const params = new URLSearchParams(location.search);
    const wantCat = params.get('cat');
    const wantWork = params.get('work');
    const startCat = wantCat && (wantCat === 'все' || all.some((w) => w.category === wantCat))
      ? wantCat : firstCategory;

    applyFilter(startCat);

    // перейти на конкретную работу (только в режиме категории, не в «Все работы»)
    if (wantWork && startCat !== 'все') {
      const norm = (s) => (s || '').normalize('NFC').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
      const i = list.findIndex((w) => norm(w.title) === norm(wantWork));
      if (i > 0) { current = i; render(0); }
    }
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
        : `<div class="grid-media"><img src="${w.thumb || w.images[0]}" alt="${w.title}" loading="lazy">${w.group ? `<span class="grid-badge">${w.images.length}</span>` : ''}</div>`;
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
      else b.innerHTML = `<img src="${w.thumb || w.images[0]}" alt="${w.title}" loading="lazy">`;
      if (w.group) b.insertAdjacentHTML('beforeend', `<span class="thumb-badge">${w.images.length}</span>`);
      b.addEventListener('click', () => go(i));
      els.strip.appendChild(b);
    });
  }

  /* ---------- центр coverflow ---------- */
  function fillLayer(layer, w) {
    layer.classList.remove('multi', 'single', 'text', 'as-grid');
    layer.style.removeProperty('--cols');
    layer.style.removeProperty('--rows');
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
    // раскладка серии: в ряд или сеткой («квадратом») — задаётся в data/gallery.json
    if (n > 1) {
      const asGrid = w.layout === 'grid';
      const cols = asGrid ? Math.ceil(Math.sqrt(n)) : n;
      if (asGrid) layer.classList.add('as-grid');
      layer.style.setProperty('--cols', cols);
      layer.style.setProperty('--rows', Math.ceil(n / cols));
    }
    w.images.forEach((src, pi) => {
      const img = new Image();
      img.src = src;
      img.alt = w.parts?.[pi]?.title ? `${w.title} — ${w.parts[pi].title}` : w.title;
      // клик по конкретной части серии — открыть лайтбокс именно на ней
      if (n > 1) img.addEventListener('click', (e) => { e.stopPropagation(); openLightbox(pi); });
      layer.appendChild(img);
    });
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

    const showEl = usingA ? els.layerB : els.layerA;
    const hideEl = usingA ? els.layerA : els.layerB;
    fillLayer(showEl, w);
    els.stack.classList.toggle('is-group', w.group);
    els.stack.classList.toggle('is-grid', !!w.group && w.layout === 'grid');
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
  // Плоский список слайдов: каждая часть серии — отдельный полноэкранный слайд.
  function buildSlides() {
    const src = activeList();
    lbSlides = [];
    src.forEach((w, wi) => {
      if (w.type === 'text') {
        lbSlides.push({ type: 'text', work: w, workIndex: wi });
      } else {
        const n = w.images.length;
        w.images.forEach((s, pi) => {
          const meta = w.parts?.[pi] || {};
          lbSlides.push({
            type: 'art', src: s, title: w.title,
            partTitle: meta.title || '',
            info: meta.info || w.info,
            workIndex: wi, part: pi + 1, parts: n,
          });
        });
      }
    });
  }
  function openLightbox(startPart = 0) {
    const src = activeList();
    if (!src.length || !src[current]) return;
    buildSlides();
    const firstOfWork = lbSlides.findIndex((sl) => sl.workIndex === current);
    lbIndex = Math.max(0, Math.min((firstOfWork < 0 ? 0 : firstOfWork) + (startPart || 0), lbSlides.length - 1));
    fillLightbox();
    els.lb.classList.add('show');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => els.lb.classList.add('open'));
  }
  function fillLightbox() {
    const sl = lbSlides[lbIndex];
    if (!sl) return;
    // сброс режимов
    els.lbImg.style.display = 'none';
    els.lbText.style.display = 'none';
    els.lbMulti.style.display = 'none';
    els.lbMulti.innerHTML = '';
    els.lb.classList.toggle('has-nav', lbSlides.length > 1);
    els.lb.classList.toggle('is-text', sl.type === 'text');
    els.lb.classList.remove('is-group');

    if (sl.type === 'text') {
      const w = sl.work;
      els.lbText.style.display = '';
      els.lbText.innerHTML = '';
      const h = document.createElement('h3'); h.textContent = w.title; els.lbText.appendChild(h);
      w.body.split(/\n\s*\n/).filter(Boolean).forEach((par) => {
        const p = document.createElement('p'); p.textContent = par; els.lbText.appendChild(p);
      });
      els.lbCap.textContent = w.categoryLabel;
      return;
    }

    // одно изображение (часть серии или самостоятельная работа) — на весь экран
    els.lbImg.style.display = '';
    els.lbImg.src = sl.src;
    els.lbImg.alt = sl.partTitle ? `${sl.title} — ${sl.partTitle}` : sl.title;
    let cap = sl.partTitle ? `${sl.title} · ${sl.partTitle}` : sl.title;
    if (sl.info) cap += ` — ${sl.info}`;
    if (sl.parts > 1) cap += ` · ${sl.part}/${sl.parts}`;
    els.lbCap.textContent = cap;
  }
  function lbStep(d) {
    if (lbSlides.length < 2) return;
    const prevWork = lbSlides[lbIndex].workIndex;
    lbIndex = (lbIndex + d + lbSlides.length) % lbSlides.length;
    fillLightbox();
    // синхронизируем coverflow, когда слайд перешёл на другую работу
    const nowWork = lbSlides[lbIndex].workIndex;
    if (filter !== 'все' && nowWork !== prevWork) { current = nowWork; render(d); }
  }
  function closeLightbox() {
    els.lb.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => els.lb.classList.remove('show'), 350);
  }
})();
