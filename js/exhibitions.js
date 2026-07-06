/* Выставки: рендер таймлайна из data/exhibitions.json + превью сайта. */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const upcoming = document.getElementById('upcoming-exhibitions');
    const past = document.getElementById('past-exhibitions');
    const overlay = document.getElementById('preview-overlay');
    const frame = document.getElementById('preview-frame');

    fetch(`${BASE}/data/exhibitions.json`)
      .then((r) => r.json())
      .then((data) => {
        data.forEach((item) => {
          const isPast = item.status === 'past';
          const card = document.createElement('article');
          card.className = 'exhibition-card reveal' + (isPast ? '' : ' upcoming');

          const badge = isPast ? '' : '<span class="badge">Скоро</span>';
          card.innerHTML = `
            <div class="inner">
              <div class="exhibition-content">
                <h3>${item.title}${badge}</h3>
                <p class="exhibition-date">${item.date}</p>
                <p class="exhibition-location">${item.location}</p>
                <p class="exhibition-description">${item.description}</p>
              </div>
              ${item.url ? '<div class="exhibition-arrow">↗</div>' : ''}
            </div>`;

          if (item.url) {
            card.classList.add('clickable');
            card.querySelector('.inner').addEventListener('click', () => {
              frame.src = item.url;
              overlay.style.display = 'flex';
              document.body.style.overflow = 'hidden';
            });
          }
          (isPast ? past : upcoming).appendChild(card);
        });

        // повторно наблюдаем за новыми .reveal
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
