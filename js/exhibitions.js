/* Выставки: таймлайн из data/exhibitions.json + фотогалереи выставок
   (data/exhibitions-media.json) + превью сайта выставки в оверлее. */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const upcoming = document.getElementById('upcoming-exhibitions');
    const past = document.getElementById('past-exhibitions');
    const overlay = document.getElementById('preview-overlay');
    const frame = document.getElementById('preview-frame');

    Promise.all([
      fetch(`${BASE}/data/exhibitions.json`).then((r) => r.json()),
      fetch(`${BASE}/data/exhibitions-media.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]).then(([data, media]) => {
      data.forEach((item) => {
        const isPast = item.status === 'past';
        const photos = (item.photos && media[item.photos] ? media[item.photos] : []).map((s) => `${BASE}/${s}`);

        const card = document.createElement('article');
        card.className = 'exhibition-card reveal' + (isPast ? '' : ' upcoming');

        const badge = isPast ? '' : '<span class="badge">Скоро</span>';
        const thumbs = photos.slice(0, 3).map((src, i) =>
          `<button class="exh-thumb" data-i="${i}"><img src="${src}" alt="Фото с выставки" loading="lazy"></button>`
        ).join('');

        const actions = [];
        if (photos.length) actions.push(`<button class="exh-btn exh-photos">▦ Фотографии · ${photos.length}</button>`);
        if (item.url) actions.push(`<button class="exh-btn exh-site">Сайт выставки ↗</button>`);

        card.innerHTML = `
          <div class="inner">
            <div class="exhibition-content">
              <h3>${item.title}${badge}</h3>
              <p class="exhibition-date">${item.date}</p>
              <p class="exhibition-location">${item.location}</p>
              <p class="exhibition-description">${item.description}</p>
              ${actions.length ? `<div class="exhibition-actions">${actions.join('')}</div>` : ''}
            </div>
            ${photos.length ? `<div class="exhibition-thumbs">${thumbs}</div>` : ''}
          </div>`;

        const openGallery = (start) => openPhotos(photos, start || 0, item.title);
        if (photos.length) {
          card.querySelector('.exh-photos')?.addEventListener('click', () => openGallery(0));
          card.querySelectorAll('.exh-thumb').forEach((t) =>
            t.addEventListener('click', () => openGallery(Number(t.dataset.i)))
          );
        }
        if (item.url) {
          card.querySelector('.exh-site')?.addEventListener('click', () => {
            frame.src = item.url;
            overlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
          });
        }

        (isPast ? past : upcoming).appendChild(card);
      });

      if (typeof initReveals === 'function') initReveals();
    });

    function close() {
      overlay.style.display = 'none';
      frame.src = '';
      document.body.style.overflow = '';
    }
    document.getElementById('preview-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.style.display === 'flex') close(); });
  });
})();
