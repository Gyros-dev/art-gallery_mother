/* Выставки: таймлайн из data/exhibitions.json + фотогалереи выставок
   (data/exhibitions-media.json) + превью сайта выставки в оверлее. */
(function () {

/* ---- Статус выставки считается из даты, а не проставляется вручную ----
   Понимает записи вида «07 августа — 18 октября 2026», «16 мая — 30 ноября 2025»,
   «2026», «2001–2023». Возвращает 'past' | 'now' | 'future'. */
const MONTHS = ['январ','феврал','март','апрел','ма','июн','июл','августа','сентябр','октябр','ноябр','декабр'];
function monthIndex(word) {
  const w = (word || '').toLowerCase();
  if (/^авг/.test(w)) return 7;
  if (/^мар/.test(w)) return 2;
  if (/^ма[йея]/.test(w)) return 4;
  return MONTHS.findIndex((m, i) => i !== 2 && i !== 4 && i !== 7 && w.startsWith(m.slice(0, 4)));
}
function exhibitionPhase(dateText, today = new Date()) {
  const s = String(dateText || '');
  const years = (s.match(/\b(19|20)\d{2}\b/g) || []).map(Number);
  if (!years.length) return 'past';
  const lastYear = Math.max(...years), firstYear = Math.min(...years);
  // пары «число месяц»
  const parts = [...s.matchAll(/(\d{1,2})\s+([А-Яа-яЁё]+)/g)]
    .map((m) => ({ day: Number(m[1]), mon: monthIndex(m[2]) }))
    .filter((x) => x.mon >= 0);
  if (parts.length >= 2) {
    const start = new Date(firstYear, parts[0].mon, parts[0].day);
    const end = new Date(lastYear, parts[1].mon, parts[1].day, 23, 59, 59);
    if (end < start) end.setFullYear(end.getFullYear() + 1);
    if (today > end) return 'past';
    return today >= start ? 'now' : 'future';
  }
  if (parts.length === 1) {
    const start = new Date(firstYear, parts[0].mon, parts[0].day);
    const end = new Date(firstYear, parts[0].mon, parts[0].day, 23, 59, 59);
    return today > end ? 'past' : (today >= start ? 'now' : 'future');
  }
  // только год(ы): будущее — если год ещё не наступил
  return lastYear > today.getFullYear() ? 'future' : 'past';
}

  document.addEventListener('DOMContentLoaded', () => {
    const upcoming = document.getElementById('upcoming-exhibitions');
    const past = document.getElementById('past-exhibitions');
    const overlay = document.getElementById('preview-overlay');
    const frame = document.getElementById('preview-frame');

    Promise.all([
      fetch(`${BASE}/data/exhibitions.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${BASE}/data/exhibitions-media.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]).then(([data, media]) => {
      data.forEach((item) => {
        const phase = exhibitionPhase(item.date);
        const isPast = phase === 'past';
        const photos = (item.photos && media[item.photos] ? media[item.photos] : []).map((s) => `${BASE}/${s}`);

        const card = document.createElement('article');
        card.className = 'exhibition-card reveal' + (isPast ? '' : ' upcoming');

        const badge = isPast ? ''
          : `<span class="badge${phase === 'now' ? ' now' : ''}">${phase === 'now' ? 'Идёт сейчас' : 'Скоро'}</span>`;
        const thumbs = photos.slice(0, 3).map((src, i) =>
          `<button class="exh-thumb" data-i="${i}"><img src="${esc(src)}" alt="Фото с выставки" loading="lazy"></button>`
        ).join('');

        // во фрейм пускаем только внешние https-адреса: относительный путь
        // означал бы свой домен, а это в паре с sandbox небезопасно
        const siteUrl = /^https:\/\//i.test(String(item.url || '').trim()) ? safeUrl(item.url) : '';
        const actions = [];
        if (photos.length) actions.push(`<button class="exh-btn exh-photos">▦ Фотографии · ${photos.length}</button>`);
        if (siteUrl) actions.push(`<button class="exh-btn exh-site">Сайт выставки ↗</button>`);

        const line = (cls, val) => (val ? `<p class="${cls}">${esc(val)}</p>` : '');
        card.innerHTML = `
          <div class="inner">
            <div class="exhibition-content">
              <h3>${esc(item.title)}${badge}</h3>
              ${line('exhibition-date', item.date)}
              ${line('exhibition-location', item.location)}
              ${line('exhibition-description', item.description)}
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
        if (siteUrl) {
          card.querySelector('.exh-site')?.addEventListener('click', () => {
            frame.src = siteUrl;
            overlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
          });
        }

        (isPast ? past : upcoming).appendChild(card);
      });

      // Секцию «Текущие и будущие» показываем только если есть такие выставки
      const upcomingCount = data.filter((i) => exhibitionPhase(i.date) !== 'past').length;
      const upcomingGroup = document.getElementById('upcoming-group');
      if (upcomingGroup) upcomingGroup.hidden = upcomingCount === 0;
      const emptyMsg = document.getElementById('exh-empty');
      if (emptyMsg) emptyMsg.hidden = data.length !== 0;

      // Архив: показываем группу только если есть прошедшие, свёрнут по умолчанию
      const pastCount = data.filter((i) => exhibitionPhase(i.date) === 'past').length;
      const archiveGroup = document.getElementById('archive-group');
      const toggle = document.getElementById('archive-toggle');
      if (pastCount && archiveGroup && toggle) {
        archiveGroup.hidden = false;
        document.getElementById('archive-count').textContent = pastCount;
        const setOpen = (open) => {
          past.classList.toggle('collapsed', !open);
          toggle.classList.toggle('open', open);
          toggle.setAttribute('aria-expanded', String(open));
        };
        // если нет текущих выставок — архив сразу раскрыт
        setOpen(upcomingCount === 0);
        toggle.addEventListener('click', () => setOpen(past.classList.contains('collapsed')));
      }

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
