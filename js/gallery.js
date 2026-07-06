/* Галерея: работы строятся из папок images/art/<Категория>/.
   Работа = одно изображение или серия (подпапка) из нескольких.
   Источник: data/gallery.json (локально/фолбэк). На живом сайте —
   тихое обновление из GitHub API, чтобы подхватывать новые файлы без пересборки.
   BASE/REDUCED объявлены в common.js. */

(function () {
  const REPO = { owner: 'Gyros-dev', name: 'art-gallery_mother', branch: 'main' };
  const CAT_LABELS = { gobelin: 'Гобелен', collage: 'Коллаж' };
  const IMG_RE = /\.(jpe?g|png|webp|avif|gif)$/i;
  const cmp = (a, b) => a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' });

  let all = [];      // все работы (плоский список)
  let list = [];     // отфильтрованные
  let current = 0;
  let filter = 'все';
  let usingA = true;
  let cooldown = false;
  let lbIndex = 0;
  let sig = '';      // подпись текущего набора — чтобы не перерисовывать зря

  const els = {};

  document.addEventListener('DOMContentLoaded', async () => {
    cache();
    bindEvents();
    setData(await loadData(), false);
    if (/(^|\.)github\.io$/.test(location.hostname)) refreshFromApi();
  });

  function cache() {
    els.filters = document.querySelector('[data-filters]');
    els.left = document.querySelector('.cf-side.left');
    els.right = document.querySelector('.cf-side.right');
    els.leftImg = els.left.querySelector('img');
    els.rightImg = els.right.querySelector('img');
    els.stack = document.querySelector('.cf-center .stack');
    els.layerA = document.querySelector('.layer.a');
    els.layerB = document.querySelector('.layer.b');
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

  /* ---------- источники данных ---------- */
  async function loadData() {
    try {
      const r = await fetch(`${BASE}/data/gallery.json`, { cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch { /* нет файла — покажем пусто */ }
    return { categories: [] };
  }

  function buildFromTree(tree) {
    const cats = [
      { id: 'gobelin', label: 'Гобелен', prefix: 'images/art/Gobelin/' },
      { id: 'collage', label: 'Коллаж', prefix: 'images/art/Collage/' },
    ];
    return cats.map((c) => {
      const singles = {}, groups = {};
      tree
        .filter((t) => t.type === 'blob' && t.path.startsWith(c.prefix) && IMG_RE.test(t.path))
        .forEach((t) => {
          const rest = t.path.slice(c.prefix.length);
          const parts = rest.split('/');
          if (parts.length === 1) singles[parts[0].replace(IMG_RE, '')] = t.path;
          else (groups[parts[0]] ||= []).push(t.path);
        });
      const works = [];
      Object.keys(singles).sort(cmp).forEach((title) => works.push({ title, group: false, images: [singles[title]] }));
      Object.keys(groups).sort(cmp).forEach((g) => works.push({ title: g, group: true, images: groups[g].sort(cmp) }));
      return { id: c.id, label: c.label, works };
    });
  }

  async function refreshFromApi() {
    try {
      const url = `https://api.github.com/repos/${REPO.owner}/${REPO.name}/git/trees/${REPO.branch}?recursive=1`;
      const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) return;
      const json = await r.json();
      if (!Array.isArray(json.tree)) return;
      const categories = buildFromTree(json.tree);
      if (categories.reduce((n, c) => n + c.works.length, 0) === 0) return;
      setData({ categories }, true);
    } catch { /* офлайн/лимит — остаёмся на gallery.json */ }
  }

  function setData(data, keepView) {
    const flat = [];
    (data.categories || []).forEach((c) => {
      (c.works || []).forEach((w) => {
        flat.push({
          title: w.title,
          category: c.id,
          categoryLabel: c.label || CAT_LABELS[c.id] || c.id,
          group: !!w.group && (w.images || []).length > 1,
          images: (w.images || []).map((s) => `${BASE}/${s}`),
          info: w.info || '',
        });
      });
    });
    const newSig = JSON.stringify(flat.map((w) => w.images));
    if (newSig === sig) return;      // ничего не изменилось
    sig = newSig;
    all = flat;
    buildFilters(data.categories || []);
    applyFilter(keepView && all.some((w) => w.category === filter || filter === 'все') ? filter : 'все');
  }

  /* ---------- фильтры ---------- */
  function buildFilters(categories) {
    const cats = ['все', ...categories.filter((c) => (c.works || []).length).map((c) => c.id)];
    els.filters.innerHTML = '';
    cats.forEach((id) => {
      const b = document.createElement('button');
      b.className = 'chip' + (id === filter ? ' active' : '');
      b.textContent = id === 'все' ? 'Все работы' : (CAT_LABELS[id] || id);
      b.dataset.cat = id;
      b.addEventListener('click', () => applyFilter(id));
      els.filters.appendChild(b);
    });
  }

  function applyFilter(cat) {
    filter = cat;
    list = cat === 'все' ? all.slice() : all.filter((w) => w.category === cat);
    current = 0;
    els.filters.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.cat === cat));
    buildStrip();
    render(0);
  }

  function buildStrip() {
    els.strip.innerHTML = '';
    list.forEach((w, i) => {
      const b = document.createElement('button');
      b.className = 'thumb';
      b.innerHTML = `<img src="${w.images[0]}" alt="${w.title}" loading="lazy">`;
      if (w.group) b.insertAdjacentHTML('beforeend', '<span class="thumb-badge">' + w.images.length + '</span>');
      b.addEventListener('click', () => go(i));
      els.strip.appendChild(b);
    });
  }

  /* ---------- отрисовка ---------- */
  function fillLayer(layer, w) {
    const n = w.images.length;
    layer.classList.toggle('multi', n > 1);
    layer.classList.toggle('single', n === 1);
    layer.innerHTML = '';
    w.images.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.alt = w.title;
      if (n > 1) img.style.maxWidth = `calc((min(88vw, 1120px) - ${n - 1} * 1.2rem) / ${n})`;
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
    const prev = list[(current - 1 + n) % n];
    const next = list[(current + 1) % n];

    els.leftImg.src = prev.images[0]; els.leftImg.alt = prev.title;
    els.rightImg.src = next.images[0]; els.rightImg.alt = next.title;
    els.left.style.display = n > 1 ? '' : 'none';
    els.right.style.display = n > 1 ? '' : 'none';

    const showEl = usingA ? els.layerB : els.layerA;
    const hideEl = usingA ? els.layerA : els.layerB;
    fillLayer(showEl, w);
    els.stack.classList.toggle('is-group', w.group);

    showEl.classList.remove('enter-left', 'enter-right');
    if (dir === 1) showEl.classList.add('enter-right');
    else if (dir === -1) showEl.classList.add('enter-left');
    requestAnimationFrame(() => {
      showEl.classList.add('show');
      showEl.classList.remove('enter-left', 'enter-right');
      hideEl.classList.remove('show');
    });
    usingA = !usingA;

    if (!REDUCED && dir) { els.shuttle.classList.remove('run'); void els.shuttle.offsetWidth; els.shuttle.classList.add('run'); }

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
    document.querySelector('.cf-center').addEventListener('click', openLightbox);

    document.addEventListener('keydown', (e) => {
      if (els.lb.classList.contains('open')) {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') lbStep(-1);
        else if (e.key === 'ArrowRight') lbStep(1);
        return;
      }
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

  /* ---------- лайтбокс (с листанием частей серии) ---------- */
  function openLightbox() {
    if (!list.length) return;
    lbIndex = 0;
    els.lb.classList.toggle('single', list[current].images.length < 2);
    fillLightbox();
    els.lb.classList.add('show');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => els.lb.classList.add('open'));
  }
  function fillLightbox() {
    const w = list[current];
    els.lbImg.src = w.images[lbIndex];
    els.lbImg.alt = w.title;
    els.lbCap.textContent = w.images.length > 1 ? `${w.title} · ${lbIndex + 1}/${w.images.length}` : w.title;
  }
  function lbStep(d) {
    const w = list[current];
    if (w.images.length < 2) return;
    lbIndex = (lbIndex + d + w.images.length) % w.images.length;
    fillLightbox();
  }
  function closeLightbox() {
    els.lb.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => els.lb.classList.remove('show'), 350);
  }
})();
