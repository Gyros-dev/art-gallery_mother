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
// Эскиз для сетки/ленты: images/art/... → images/thumbs/....webp (если файл есть).
async function thumbFor(imgPath) {
  const t = imgPath.replace(/^images\/art\//, 'images/thumbs/').replace(/\.[^.]+$/, '.webp');
  try { await access(path.join(ROOT, t)); return t; }
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
      const { width, height } = await sharp(path.join(ROOT, rel)).metadata();
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
    const images = [`${base}/${f}`];
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
    const images = parts.map((p) => `${base}/${d.name}/${p}`);
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

async function main() {
  const gallery = await buildGallery();
  const texts = await buildTexts();
  const media = await buildExhibitionMedia();
  await writeFile(path.join(ROOT, 'data/gallery.json'), JSON.stringify(gallery, null, 2) + '\n');
  await writeFile(path.join(ROOT, 'data/texts.json'), JSON.stringify(texts, null, 2) + '\n');
  await writeFile(path.join(ROOT, 'data/exhibitions-media.json'), JSON.stringify(media, null, 2) + '\n');
  console.log('Готово: data/gallery.json, data/texts.json, data/exhibitions-media.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
