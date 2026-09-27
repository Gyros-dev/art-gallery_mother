/* Литература: PDF-пособия и публикации из content/texts. */
(function () {
  const overlay = document.getElementById('pdf-overlay');
  const viewer = document.getElementById('pdf-viewer');

  /* Встроенная читалка — только там, где она действительно работает.
     На телефоне PDF во фрейме показывает первую страницу и не листается,
     поэтому там документ открывается обычной ссылкой: системная читалка
     листает, масштабирует и умеет сохранить файл. */
  const canEmbedPdf = () => matchMedia('(min-width: 861px) and (hover: hover)').matches;

  function openPdf(href) {
    viewer.src = href;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function close() { overlay.style.display = 'none'; viewer.src = ''; document.body.style.overflow = ''; }
  document.getElementById('pdf-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  /* Учебные материалы, каталоги и прочие разделы — из data/library.json.
     Раздел задаётся у каждой записи словом;новый раздел появляется сам, как
     только в поле «Раздел» впервые встречается новое название. */
  fetch(`${BASE}/data/library.json`, NOCACHE)
    .then((r) => (r.ok ? r.json() : []))
    .then((items) => {
      const box = document.getElementById('library');
      if (!box || !Array.isArray(items) || !items.length) return;

      const order = [];
      const groups = new Map();
      items.forEach((it) => {
        const name = (it.section || 'Материалы').trim();
        if (!groups.has(name)) { groups.set(name, []); order.push(name); }
        groups.get(name).push(it);
      });

      order.forEach((name) => {
        const h = document.createElement('h2');
        h.className = 'lit-subhead reveal';
        h.textContent = name;
        box.appendChild(h);

        const ul = document.createElement('ul');
        ul.className = 'literature-list';
        groups.get(name).forEach((it, i) => {
          const li = document.createElement('li');
          li.className = 'reveal' + (i ? ` d${Math.min(i, 3)}` : '');
          const href = it.file ? `${BASE}/${String(it.file).replace(/^\/+/, '')}` : '';
          li.innerHTML = href
            ? `<a class="lit-link" href="${esc(href)}" target="_blank" rel="noopener">
                 <span class="lit-num">${String(i + 1).padStart(2, '0')}</span>
                 <span class="lit-body"><span class="lit-title"></span><span class="lit-kind"></span></span>
                 <span class="lit-arrow">↗</span>
               </a>`
            : `<button class="lit-link" disabled>
                 <span class="lit-num">${String(i + 1).padStart(2, '0')}</span>
                 <span class="lit-body"><span class="lit-title"></span><span class="lit-kind"></span></span>
                 <span class="lit-arrow">↗</span>
               </button>`;
          li.querySelector('.lit-title').textContent = it.title || '';
          li.querySelector('.lit-kind').textContent = it.kind || '';
          const link = li.querySelector('a.lit-link');
          if (link) link.addEventListener('click', (e) => {
            if (!canEmbedPdf()) return;     // на телефоне — как обычная ссылка
            e.preventDefault();
            openPdf(link.href);
          });
          ul.appendChild(li);
        });
        box.appendChild(ul);
      });
      if (typeof initReveals === 'function') initReveals();
    });

  // Публикации из content/texts (data/texts.json)
  const textOverlay = document.getElementById('text-overlay');
  const reader = document.getElementById('text-reader');
  function openText(item) {
    reader.innerHTML = '';
    const h = document.createElement('h2'); h.textContent = item.title; reader.appendChild(h);
    item.body.split(/\n\s*\n/).filter(Boolean).forEach((par) => {
      const p = document.createElement('p'); p.textContent = par; reader.appendChild(p);
    });
    textOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function closeText() { textOverlay.style.display = 'none'; document.body.style.overflow = ''; }
  document.getElementById('text-close').addEventListener('click', closeText);
  textOverlay.addEventListener('click', (e) => { if (e.target === textOverlay) closeText(); });

  fetch(`${BASE}/data/texts.json`, NOCACHE).then((r) => (r.ok ? r.json() : [])).then((texts) => {
    if (!texts.length) return;
    const section = document.getElementById('publications-section');
    const listEl = document.getElementById('publications-list');
    section.hidden = false;
    texts.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = 'reveal';
      const preview = item.body.replace(/\n+/g, ' ').slice(0, 110);
      li.innerHTML = `
        <button class="lit-link">
          <span class="lit-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="lit-body"><span class="lit-title"></span><span class="lit-kind"></span></span>
          <span class="lit-arrow">↗</span>
        </button>`;
      li.querySelector('.lit-title').textContent = item.title;
      li.querySelector('.lit-kind').textContent = preview + (item.body.length > 110 ? '…' : '');
      li.querySelector('.lit-link').addEventListener('click', () => openText(item));
      listEl.appendChild(li);
    });
    if (typeof initReveals === 'function') initReveals();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (overlay.style.display === 'flex') close();
    if (textOverlay.style.display === 'flex') closeText();
  });
})();
