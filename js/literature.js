/* Литература: PDF-пособия и публикации из content/texts. */
(function () {
  const overlay = document.getElementById('pdf-overlay');
  const viewer = document.getElementById('pdf-viewer');
  document.querySelectorAll('.lit-link[data-pdf]').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewer.src = `${BASE}/${btn.dataset.pdf}`;
      overlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
  });
  function close() { overlay.style.display = 'none'; viewer.src = ''; document.body.style.overflow = ''; }
  document.getElementById('pdf-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

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

  fetch(`${BASE}/data/texts.json`).then((r) => (r.ok ? r.json() : [])).then((texts) => {
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
