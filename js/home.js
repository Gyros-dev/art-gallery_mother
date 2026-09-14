/* Главная: канвас-«станок» в хиро и лента «Избранное» из data/site.json. */
initLoom(document.getElementById('loom'));
Promise.all([
  fetch('data/gallery.json', NOCACHE).then((r) => r.json()),
  fetch('data/site.json', NOCACHE).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
]).then(([data, site]) => {
  const strip = document.querySelector('[data-strip]');
  if (!strip) return;
  const works = [];
  (data.categories || []).forEach((c) =>
    (c.works || []).forEach((w) => {
      if (w.type !== 'text' && w.images && w.images.length) {
        works.push({ title: w.title, images: w.images, thumb: w.thumb, cat: c.id, label: c.label });
      }
    })
  );
  // Избранное задаётся списком названий в data/site.json → "featured".
  // Если список пуст/не задан — показываем 6 случайных работ.
  const norm = (s) => (s || '').normalize('NFC').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  const featured = Array.isArray(site.featured) ? site.featured : [];
  const picks = featured.length
    ? featured.map((t) => works.find((w) => norm(w.title) === norm(t))).filter(Boolean)
    : works.slice().sort(() => Math.random() - 0.5).slice(0, 6);

  picks.forEach((w) => {
    const fig = document.createElement('figure');
    fig.innerHTML = `
      <div class="frame"><img src="${esc(w.thumb || w.images[0])}" alt="${esc(w.title)}" loading="lazy"></div>
      <figcaption><h3>${esc(w.title)}</h3><span class="cat">${esc(w.label)}</span></figcaption>`;
    // переход в галерею именно на эту работу (категория + позиция)
    fig.addEventListener('click', () => {
      location.href = `pages/gallery.html?cat=${encodeURIComponent(w.cat)}&work=${encodeURIComponent(w.title)}`;
    });
    strip.appendChild(fig);
  });
}).catch(() => {});
