#!/usr/bin/env node
/**
 * Оптимизация картинок галереи. Идемпотентно — можно запускать сколько угодно раз,
 * трогает только новые/неоптимизированные файлы.
 *
 *  images/art/**             — полноразмерные картины:
 *      jpg/png               → пережимаются в WebP ≤ 2000px, оригинал jpg/png удаляется
 *      webp > 2000px         → уменьшаются до 2000px
 *      webp ≤ 2000px         → остаются как есть
 *  images/thumbs/**          — эскизы 600px WebP для сетки/ленты (создаются, если их ещё нет)
 *
 * Запуск: node scripts/optimize-images.mjs   (в CI выполняется автоматически перед сборкой)
 */
import { readdir, rename, unlink, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART = path.join(ROOT, 'images/art');
const THUMBS = path.join(ROOT, 'images/thumbs');
const IMG = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const FULL_MAX = 2000, THUMB_MAX = 600, FULL_Q = 82, THUMB_Q = 74;

const exists = (p) => access(p).then(() => true, () => false);

async function walk(dir, cb) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, cb);
    else if (e.isFile() && !e.name.startsWith('.')) await cb(p);
  }
}

let full = 0, thumbs = 0, kept = 0, removed = 0;

await walk(ART, async (src) => {
  const ext = path.extname(src).toLowerCase();
  if (!IMG.has(ext)) return;

  const dir = path.dirname(src);
  const base = path.basename(src, path.extname(src));
  const rel = path.relative(ART, dir);
  const webpOut = path.join(dir, base + '.webp');
  const thumbDir = path.join(THUMBS, rel);
  const thumbOut = path.join(thumbDir, base + '.webp');

  const meta = await sharp(src).metadata();
  const longside = Math.max(meta.width || 0, meta.height || 0);
  const isRaster = ext !== '.webp';
  const needFull = isRaster || longside > FULL_MAX;

  // Полноразмерный WebP ≤ 2000px
  if (needFull) {
    const tmp = webpOut + '.tmp';
    await sharp(src)
      .resize({ width: FULL_MAX, height: FULL_MAX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: FULL_Q })
      .toFile(tmp);
    await rename(tmp, webpOut);
    full++;
    if (isRaster && path.resolve(src) !== path.resolve(webpOut)) { await unlink(src); removed++; }
  } else {
    kept++;
  }

  // Эскиз 600px — только если его ещё нет
  await mkdir(thumbDir, { recursive: true });
  if (!(await exists(thumbOut))) {
    const source = (await exists(webpOut)) ? webpOut : src;
    await sharp(source)
      .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: THUMB_Q })
      .toFile(thumbOut);
    thumbs++;
  }
});

console.log(`Оптимизация: пережато full ${full}, создано эскизов ${thumbs}, оставлено webp ${kept}, удалено jpg/png ${removed}`);
