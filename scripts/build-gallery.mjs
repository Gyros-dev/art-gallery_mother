#!/usr/bin/env node
/**
 * Собирает данные для сайта из папок с файлами. Ничего, кроме раскладки
 * файлов по папкам, для пополнения сайта знать не нужно.
 *
 *  images/art/<Категория>/               → категория галереи (фильтр на сайте)
 *      Название.jpg                       → работа, название = имя файла
 *      Название.txt                       → описание к этой работе (необязательно)
 *      <Серия>/*.jpg                      → серия (диптих/триптих), показывается вместе
 *      <Серия>/_info.txt                  → описание серии (необязательно)
 *      <Серия>/_layout.txt                → «квадрат» или «ряд» — как расположить части
 *                                           (необязательно; по умолчанию определяется само)
 *      <Серия>/1. Матфей.jpg              → номер в начале имени = порядок части,
 *                                           остальное = подпись части («Матфей»)
 *      <Серия>/1. Матфей.txt              → описание этой части (необязательно)
 *  content/texts/*.md|*.txt               → тексты/публикации (1-я строка = заголовок)
 *  images/exhibitions/<Выставка>/*.jpg    → фотографии с выставки
 *
 * Итог: data/gallery.json, data/texts.json, data/exhibitions-media.json
 * Запуск: node scripts/build-gallery.mjs   (в CI запускается сам при каждом пуше)
 */
import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);
const TEXT_EXT = new Set(['.txt', '.md']);

// Как назвать категорию (папку) на сайте. Незнакомые папки берут имя как есть.
const CATEGORY_LABELS = { Gobelin: 'Гобелен', Collage: 'Коллаж' };
// Порядок категорий (кто не указан — по алфавиту после указанных).
const CATEGORY_ORDER = ['Гобелен', 'Коллаж', 'Арт-объект', 'Gobelin', 'Collage'];

const byName = (a, b) => a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' });
const isImage = (f) => IMAGE_EXT.has(path.extname(f).toLowerCase());
const isText = (f) => TEXT_EXT.has(path.extname(f).toLowerCase());
const baseName = (f) => path.basename(f, path.extname(f)).trim();

async function ls(rel) {
  try { return await readdir(path.join(ROOT, rel), { withFileTypes: true }); }
  catch { return []; }
}
async function read(rel) {
  try { return (await readFile(path.join(ROOT, rel), 'utf8')).trim(); }
  catch { return ''; }
}
/* Метка версии по содержимому файла: ...webp?v=ab12cd34
   Нужна, чтобы после замены картинки браузер показал новую, а не старую из кэша
   (имя файла ведь не изменилось). Пока файл прежний — метка та же, кэш работает. */
const versionCache = new Map();
async function withVersion(rel) {
  if (versionCache.has(rel)) return versionCache.get(rel);
  let out = rel;
  try {
    const buf = await readFile(path.join(ROOT, rel));
    out = `${rel}?v=${createHash('md5').update(buf).digest('hex').slice(0, 8)}`;
  } catch { /* файла нет — оставляем путь как есть */ }
  versionCache.set(rel, out);
  return out;
}

// Эскиз для сетки/ленты: images/art/... → images/thumbs/....webp (если файл есть).
async function thumbFor(imgPath) {
  const clean = imgPath.replace(/\?.*$/, '');
  const t = clean.replace(/^images\/art\//, 'images/thumbs/').replace(/\.[^.]+$/, '.webp');
  try { await access(path.join(ROOT, t)); return await withVersion(t); }
  catch { return null; }
}

/* ---------- Части серии: порядок, подписи, раскладка ---------- */
const nfc = (s) => (s || '').normalize('NFC').trim();

/** Убирает служебную нумерацию: «1. X» → «X», «X - 2» → «X». */
function stripOrder(s) {
  return s
    .replace(/^\d+\s*[.)\]–—-]\s*/, '')
    .replace(/\s*[-–—]\s*\d+\s*$/, '')
    .trim();
}

/** Подпись части из имени файла: «1. Матфей» → «Матфей»,
 *  «Времена года - 2» (дублирует имя серии) → без подписи. */
function partTitle(fileBase, seriesName) {
  let s = stripOrder(nfc(fileBase));
  const series = nfc(seriesName);
  // «Диптих. Светлые бабочки» → части могут называться просто «Светлые бабочки - 1»
  const seriesShort = series.replace(/^(диптих|триптих|квадриптих|серия)\s*[.:,–—-]?\s*/i, '').trim();
  for (const pref of [series, seriesShort].filter(Boolean)) {
    if (pref && s.toLowerCase().startsWith(pref.toLowerCase())) {
      s = s.slice(pref.length).replace(/^\s*[.,:)\]–—-]\s*/, '').trim();
      break;
    }
  }
  s = stripOrder(s);
  if (!s || /^\d+$/.test(s)) return '';                    // остался только номер
  return s;
}

/** Раскладка серии: явно из _layout.txt, иначе по пропорциям частей. */
function parseLayout(raw) {
  const s = nfc(raw).toLowerCase();
  if (!s) return null;
  if (/квадрат|сетк|плитк|grid|2\s*[xх]\s*2|square/.test(s)) return 'grid';
  if (/ряд|строк|линт|row|line|inline/.test(s)) return 'row';
  return null;
}

let sharpLib = null, sharpTried = false;
async function getSharp() {
  if (!sharpTried) {
    sharpTried = true;
    try { sharpLib = (await import('sharp')).default; }
    catch { sharpLib = null; } // без sharp просто не будет авто-раскладки
  }
  return sharpLib;
}

/** Авто-раскладка. До 3 частей — в ряд. Ровно 4: вытянутые вертикально в ряд,
 *  квадратные/горизонтальные — квадратом. Больше 4 — всегда сеткой,
 *  иначе в одном ряду части выходят слишком мелкими. */
async function autoLayout(relPaths) {
  const n = relPaths.length;
  if (n <= 3) return 'row';
  if (n > 4) return 'grid';
  const sharp = await getSharp();
  if (!sharp) return 'row';
  let portrait = 0;
  for (const rel of relPaths) {
    try {
      const { width, height } = await sharp(path.join(ROOT, rel.replace(/\?.*$/, ''))).metadata();
      if (width && height && height > width * 1.15) portrait++;
    } catch { /* нечитаемый файл — не учитываем */ }
  }
  return portrait > n / 2 ? 'row' : 'grid';
}

/* ---------- Галерея ---------- */
async function buildCategory(dir) {
  const base = `images/art/${dir}`;
  const entries = await ls(base);
  const files = entries.filter((e) => e.isFile() && !e.name.startsWith('.'));
  const imageFiles = files.filter((e) => isImage(e.name)).map((e) => e.name);
  // NFC-нормализация: имена файлов на macOS бывают в форме NFD (й = «и»+знак),
  // и без этого сайдкар-описание ошибочно попадало в отдельную текстовую карточку.
  const imageBases = new Set(imageFiles.map((n) => baseName(n).normalize('NFC')));
  const works = [];

  // одиночные изображения
  for (const f of imageFiles.sort(byName)) {
    const images = [await withVersion(`${base}/${f}`)];
    works.push({
      title: baseName(f),
      type: 'art',
      group: false,
      images,
      thumb: await thumbFor(images[0]),
      info: await read(`${base}/${baseName(f)}.txt`),
    });
  }

  // текстовые файлы БЕЗ одноимённой картинки = текстовая работа в категории
  for (const f of files.filter((e) => isText(e.name)).map((e) => e.name).sort(byName)) {
    if (baseName(f).startsWith('_') || imageBases.has(baseName(f).normalize('NFC'))) continue;
    const raw = await read(`${base}/${f}`);
    const lines = raw.split('\n');
    works.push({
      title: lines[0].replace(/^#+\s*/, '').trim() || baseName(f),
      type: 'text',
      body: lines.slice(1).join('\n').trim(),
    });
  }

  // подпапки = серии
  for (const d of entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).sort((a, b) => byName(a.name, b.name))) {
    const parts = (await ls(`${base}/${d.name}`))
      .filter((e) => e.isFile() && isImage(e.name)).map((e) => e.name).sort(byName);
    if (!parts.length) continue;
    const images = [];
    for (const p of parts) images.push(await withVersion(`${base}/${d.name}/${p}`));
    // подпись и описание каждой части
    const partsMeta = [];
    for (const p of parts) {
      partsMeta.push({
        title: partTitle(baseName(p), d.name),
        info: await read(`${base}/${d.name}/${baseName(p)}.txt`),
      });
    }
    // раскладка: явно из _layout.txt, иначе автоматически по пропорциям
    const layout = parseLayout(await read(`${base}/${d.name}/_layout.txt`))
      || await autoLayout(images);
    works.push({
      title: d.name,
      type: 'art',
      group: true,
      layout,
      images,
      parts: partsMeta,
      thumb: await thumbFor(images[0]),
      info: await read(`${base}/${d.name}/_info.txt`),
    });
  }

  return works;
}

async function buildGallery() {
  const dirs = (await ls('images/art'))
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
  dirs.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return byName(a, b);
  });

  const categories = [];
  for (const dir of dirs) {
    const works = await buildCategory(dir);
    if (!works.length) continue;
    categories.push({ id: dir.toLowerCase(), label: CATEGORY_LABELS[dir] || dir, works });
    console.log(`Категория «${CATEGORY_LABELS[dir] || dir}»: ${works.length} работ`);
  }
  return { generated: new Date().toISOString(), categories };
}

/* ---------- Тексты / публикации ---------- */
async function buildTexts() {
  const files = (await ls('content/texts'))
    .filter((e) => e.isFile() && isText(e.name)).map((e) => e.name).sort(byName);
  const items = [];
  for (const f of files) {
    const raw = await read(`content/texts/${f}`);
    const lines = raw.split('\n');
    items.push({
      title: lines[0].replace(/^#+\s*/, '').trim() || baseName(f),
      body: lines.slice(1).join('\n').trim(),
    });
  }
  console.log(`Тексты: ${items.length}`);
  return items;
}

/* ---------- Фото выставок ---------- */
async function buildExhibitionMedia() {
  const out = {};
  for (const d of (await ls('images/exhibitions')).filter((e) => e.isDirectory() && !e.name.startsWith('.'))) {
    const imgs = (await ls(`images/exhibitions/${d.name}`))
      .filter((e) => e.isFile() && isImage(e.name)).map((e) => e.name).sort(byName);
    if (imgs.length) out[d.name] = imgs.map((f) => `images/exhibitions/${d.name}/${f}`);
  }
  console.log(`Выставки с фото: ${Object.keys(out).length}`);
  return out;
}

/* ================= Мета-теги, карта сайта и проверка данных =================
   Всё берётся из data/site.json. Поменяли домен там — обновится везде. */

const PAGES = [
  { file: 'index.html',            loc: '',                       priority: '1.0',
    title: (s) => s.title,
    desc:  (s) => s.description },
  { file: 'pages/gallery.html',    loc: 'pages/gallery.html',     priority: '0.9',
    title: (s) => `Галерея работ — ${s.name}`,
    desc:  () => 'Гобелены ручного ткачества, текстильные коллажи и арт-объекты Анны Векслер: более 70 работ с описанием техники, размеров и года создания.' },
  { file: 'pages/exhibitions.html', loc: 'pages/exhibitions.html', priority: '0.8',
    title: (s) => `Выставки — ${s.name}`,
    desc:  () => 'Выставки Анны Векслер: текущие и будущие экспозиции, архив участия в российских и зарубежных выставках, персональные проекты.' },
  { file: 'pages/about.html',      loc: 'pages/about.html',       priority: '0.8',
    title: (s) => `Об авторе — ${s.name}`,
    desc:  () => 'Анна Векслер — художник декоративного искусства, член Союза художников России, кандидат педагогических наук, профессор. Биография, выставки, награды, работы в собраниях музеев.' },
  { file: 'pages/literature.html', loc: 'pages/literature.html',  priority: '0.6',
    title: (s) => `Публикации и пособия — ${s.name}`,
    desc:  () => 'Публикации о творчестве Анны Векслер и учебно-методические пособия по ручному ткачеству и художественному текстилю.' },
];

const OG_IMAGE = 'assets/og-preview.jpg';

function metaBlock(site, page, indent) {
  const base = String(site.url || '').replace(/\/+$/, '');
  const abs = (p) => (p ? `${base}/${p}` : `${base}/`);
  const t = page.title(site), d = page.desc(site);
  const tags = [
    `<title>${escAttr(t)}</title>`,
    `<meta name="description" content="${escAttr(d)}">`,
    `<link rel="canonical" href="${escAttr(abs(page.loc))}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escAttr(site.title)}">`,
    `<meta property="og:title" content="${escAttr(t)}">`,
    `<meta property="og:description" content="${escAttr(d)}">`,
    `<meta property="og:url" content="${escAttr(abs(page.loc))}">`,
    `<meta property="og:image" content="${escAttr(abs(OG_IMAGE))}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:locale" content="ru_RU">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ];
  return tags.map((x) => indent + x).join('\n');
}
const escAttr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Разметка для поисковиков: кто автор и что за работы. */
function jsonLd(site, gallery) {
  const base = String(site.url || '').replace(/\/+$/, '');
  const works = gallery.categories.flatMap((c) => c.works.filter((w) => w.type !== 'text').map((w) => ({ w, c })));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person', '@id': `${base}/#person`,
        name: site.name, jobTitle: 'Художник декоративного искусства',
        description: site.description,
        url: `${base}/`,
        address: { '@type': 'PostalAddress', addressLocality: 'Санкт-Петербург', addressCountry: 'RU' },
        knowsAbout: ['Гобелен', 'Ручное ткачество', 'Текстильный коллаж', 'Декоративно-прикладное искусство'],
      },
      {
        '@type': 'WebSite', '@id': `${base}/#website`,
        name: site.title, url: `${base}/`, inLanguage: 'ru-RU',
        author: { '@id': `${base}/#person` },
      },
      ...works.slice(0, 60).map(({ w, c }) => ({
        '@type': 'VisualArtwork',
        name: w.title,
        artform: c.label,
        creator: { '@id': `${base}/#person` },
        image: `${base}/${String(w.images[0]).replace(/\?.*$/, '')}`,
        ...(w.info ? { description: w.info } : {}),
      })),
    ],
  };
}

/** Картинка-превью для соцсетей (1200×630): работа на «бумажном» фоне.
    Берётся первая работа из «Избранного» — меняете её, меняется и превью. */
async function generateOgImage(site, gallery) {
  const sharp = await getSharp();
  if (!sharp) { console.warn('  ! sharp недоступен — превью для соцсетей не обновлено'); return; }
  const nfc = (x) => (x || '').normalize('NFC').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  const works = gallery.categories.flatMap((c) => c.works).filter((w) => w.type !== 'text' && w.images?.length);
  const wanted = (site.featured || [])[0];
  const pick = works.find((w) => nfc(w.title) === nfc(wanted)) || works[0];
  if (!pick) return;
  const src = path.join(ROOT, String(pick.images[0]).replace(/\?.*$/, ''));
  const art = await sharp(src)
    .resize({ width: 1040, height: 510, fit: 'inside', withoutEnlargement: false })
    .toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#efece4' } })
    .composite([{ input: art, gravity: 'centre' }])
    .jpeg({ quality: 86 })
    .toFile(path.join(ROOT, 'assets/og-preview.jpg'));
  console.log(`Превью для соцсетей обновлено (работа «${pick.title}»)`);
}

async function writeMetaAndSeo(site, gallery) {
  const base = String(site.url || '').replace(/\/+$/, '');
  // 1) мета-теги в каждую страницу — между маркерами
  for (const page of PAGES) {
    const file = path.join(ROOT, page.file);
    let html;
    try { html = await readFile(file, 'utf8'); } catch { continue; }
    const re = /([ \t]*)<!-- meta:start[^>]*-->[\s\S]*?<!-- meta:end -->/;
    const m = re.exec(html);
    if (!m) { console.warn(`  ! в ${page.file} нет маркеров meta:start/meta:end`); continue; }
    const indent = m[1] || '  ';
    const replacement = `${indent}<!-- meta:start — заполняется сборкой из data/site.json, вручную не править -->\n`
      + metaBlock(site, page, indent) + `\n${indent}<!-- meta:end -->`;
    await writeFile(file, html.replace(re, replacement));
  }
  // 2) карта сайта
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + PAGES.map((p) => `  <url>\n    <loc>${base}/${p.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${p.priority}</priority>\n  </url>`).join('\n')
    + `\n</urlset>\n`;
  await writeFile(path.join(ROOT, 'sitemap.xml'), sitemap);
  // 3) robots.txt
  await writeFile(path.join(ROOT, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
  // 4) разметка Schema.org
  await writeFile(path.join(ROOT, 'data/schema.json'), JSON.stringify(jsonLd(site, gallery), null, 2) + '\n');

  // 5) разметка Schema.org прямо в главную страницу
  const idx = path.join(ROOT, 'index.html');
  let home = await readFile(idx, 'utf8');
  const ldRe = /([ \t]*)<!-- schema:start[^>]*-->[\s\S]*?<!-- schema:end -->/;
  if (ldRe.test(home)) {
    const ind = ldRe.exec(home)[1] || '  ';
    const json = JSON.stringify(jsonLd(site, gallery));
    home = home.replace(ldRe,
      `${ind}<!-- schema:start — заполняется сборкой, вручную не править -->\n`
      + `${ind}<script type="application/ld+json">${json}</script>\n`
      + `${ind}<!-- schema:end -->`);
    await writeFile(idx, home);
  }
  await generateOgImage(site, gallery);
  console.log(`Мета-теги, sitemap.xml, robots.txt и разметка обновлены (адрес сайта: ${base})`);
}

/* ---------- Проверка данных: ловим ошибки до публикации ---------- */
function checkData(site, exhibitions) {
  const problems = [];
  if (!site.url || !/^https?:\/\//.test(site.url)) problems.push('в data/site.json поле "url" пустое или без https://');
  if (!site.title) problems.push('в data/site.json не заполнено "title" (название сайта)');
  (site.socials || []).forEach((s, i) => {
    if (s.url && !/^https?:\/\//i.test(s.url)) problems.push(`соцсеть №${i + 1} ("${s.label}"): ссылка должна начинаться с https://`);
  });
  exhibitions.forEach((e, i) => {
    const n = `выставка №${i + 1}` + (e.title ? ` («${String(e.title).slice(0, 40)}»)` : '');
    if (!e.title) problems.push(`${n}: не заполнено "title" (название)`);
    if (!e.date) problems.push(`${n}: не заполнено "date" (дата)`);
    if (e.url && !/^https?:\/\//i.test(e.url)) problems.push(`${n}: "url" должен начинаться с https://`);
  });
  return problems;
}

async function readJson(rel, fallback) {
  try { return JSON.parse(await readFile(path.join(ROOT, rel), 'utf8')); }
  catch (e) {
    console.error(`\n  ОШИБКА в файле ${rel}: ${e.message}`);
    console.error('  Скорее всего пропущена запятая или кавычка. Проверьте файл — сайт собран со старыми данными.\n');
    return fallback;
  }
}

async function main() {
  const gallery = await buildGallery();
  const texts = await buildTexts();
  const media = await buildExhibitionMedia();
  await writeFile(path.join(ROOT, 'data/gallery.json'), JSON.stringify(gallery, null, 2) + '\n');
  await writeFile(path.join(ROOT, 'data/texts.json'), JSON.stringify(texts, null, 2) + '\n');
  await writeFile(path.join(ROOT, 'data/exhibitions-media.json'), JSON.stringify(media, null, 2) + '\n');

  const site = await readJson('data/site.json', null);
  const exhibitions = await readJson('data/exhibitions.json', []);
  if (!site) { console.error('Без data/site.json мета-теги не собрать.'); process.exit(1); }

  const problems = checkData(site, exhibitions);
  if (problems.length) {
    console.error('\n  НАЙДЕНЫ ОШИБКИ В ДАННЫХ — исправьте и загрузите снова:');
    problems.forEach((p) => console.error('   • ' + p));
    console.error('');
    process.exit(1);
  }

  await writeMetaAndSeo(site, gallery);
  console.log('Готово: каталог, мета-теги, sitemap.xml, robots.txt');
}

main().catch((e) => { console.error(e); process.exit(1); });
