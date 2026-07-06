#!/usr/bin/env node
/**
 * Собирает data/gallery.json из папок images/art/<Категория>/.
 *
 * Правила:
 *  - images/art/Gobelin, images/art/Collage — категории.
 *  - Файл прямо в папке категории = отдельная работа, название = имя файла.
 *  - Подпапка = серия (диптих/триптих), которая показывается вместе,
 *    название = имя подпапки, порядок частей — по имени файла.
 *  - Необязательное описание: рядом с файлом `Название.txt`, а для серии —
 *    файл `_info.txt` внутри подпапки. Содержимое покажется под работой.
 *
 * Запуск: node scripts/build-gallery.mjs
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART = 'images/art';

const CATEGORIES = [
  { id: 'gobelin', dir: 'Gobelin', label: 'Гобелен' },
  { id: 'collage', dir: 'Collage', label: 'Коллаж' },
];

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);

const byName = (a, b) => a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' });
const isImage = (f) => IMAGE_EXT.has(path.extname(f).toLowerCase());
const titleOf = (f) => path.basename(f, path.extname(f)).trim();

async function ls(rel) {
  try {
    return await readdir(path.join(ROOT, rel), { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readInfo(rel) {
  try {
    return (await readFile(path.join(ROOT, rel), 'utf8')).trim();
  } catch {
    return '';
  }
}

async function buildCategory(cat) {
  const base = `${ART}/${cat.dir}`;
  const entries = await ls(base);
  const works = [];

  // одиночные файлы
  const files = entries.filter((e) => e.isFile() && !e.name.startsWith('.') && isImage(e.name));
  for (const f of files.sort((a, b) => byName(a.name, b.name))) {
    const title = titleOf(f.name);
    works.push({
      title,
      category: cat.id,
      group: false,
      images: [`${base}/${f.name}`],
      info: await readInfo(`${base}/${title}.txt`),
    });
  }

  // подпапки = серии
  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));
  for (const d of dirs.sort((a, b) => byName(a.name, b.name))) {
    const inner = await ls(`${base}/${d.name}`);
    const parts = inner
      .filter((e) => e.isFile() && isImage(e.name))
      .map((e) => e.name)
      .sort(byName);
    if (!parts.length) continue;
    works.push({
      title: d.name,
      category: cat.id,
      group: true,
      images: parts.map((p) => `${base}/${d.name}/${p}`),
      info: await readInfo(`${base}/${d.name}/_info.txt`),
    });
  }

  return { id: cat.id, label: cat.label, works };
}

async function main() {
  const categories = [];
  for (const cat of CATEGORIES) {
    const built = await buildCategory(cat);
    categories.push(built);
    const groups = built.works.filter((w) => w.group).length;
    console.log(`${cat.label}: ${built.works.length} работ (из них серий: ${groups})`);
  }
  const out = { generated: new Date().toISOString(), categories };
  await writeFile(path.join(ROOT, 'data/gallery.json'), JSON.stringify(out, null, 2) + '\n');
  console.log('data/gallery.json готов');
}

main().catch((e) => { console.error(e); process.exit(1); });
