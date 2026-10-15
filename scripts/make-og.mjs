// Generates social preview images (1200×630 PNG) into public/og/.
// Run after adding posts:  node scripts/make-og.mjs
// Posts without an image fall back to public/og/default.png.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BLOG = 'src/content/blog';
const OUT = 'public/og';
const CATS = { homelab: 'Homelab', 'game-servers': 'Game servers', roblox: 'Roblox dev' };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function wrap(text, max) {
  const lines = []; let line = '';
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max) { lines.push(line.trim()); line = word; }
    else line += ' ' + word;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function svg({ title, label }) {
  let size = 62, max = 26, lines = wrap(title, max);
  if (lines.length > 4) { size = 50; max = 33; lines = wrap(title, max); }
  if (lines.length > 5) { lines = lines.slice(0, 5); lines[4] = lines[4].replace(/\s*\S*$/, ' …'); }
  const lineH = Math.round(size * 1.18);
  const startY = 315 - ((lines.length - 1) * lineH) / 2 + size / 3;
  const tspans = lines.map((l, i) => `<tspan x="80" y="${startY + i * lineH}">${esc(l)}</tspan>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#121416"/>
  <rect x="0" y="0" width="16" height="630" fill="#4fd1a5"/>
  <text x="80" y="110" font-family="DejaVu Sans" font-size="30" font-weight="bold" fill="#4fd1a5">${esc(label.toUpperCase())}</text>
  <text font-family="DejaVu Sans" font-size="${size}" font-weight="bold" fill="#e8e6e3">${tspans}</text>
  <text x="80" y="560" font-family="DejaVu Sans" font-size="34" font-weight="bold" fill="#e8e6e3">Real<tspan fill="#4fd1a5">Fin</tspan></text>
  <text x="1120" y="560" text-anchor="end" font-family="DejaVu Sans" font-size="28" fill="#a3a8ad">realfin.dev</text>
</svg>`;
}

const render = (file, data) => sharp(Buffer.from(svg(data))).png().toFile(path.join(OUT, file));

fs.mkdirSync(OUT, { recursive: true });
await render('default.png', { title: 'A real homelab, written down: self-hosting, game servers and Roblox dev', label: 'realfin.dev' });
let n = 0;
for (const f of fs.readdirSync(BLOG).filter((f) => f.endsWith('.md'))) {
  const src = fs.readFileSync(path.join(BLOG, f), 'utf8');
  const fm = src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const title = fm.match(/^title:\s*"?(.*?)"?\s*$/m)?.[1];
  const cat = fm.match(/^category:\s*(\S+)/m)?.[1];
  if (!title || /^draft:\s*true/m.test(fm)) continue;
  await render(f.replace(/\.md$/, '.png'), { title: title.replace(/\\"/g, '"'), label: CATS[cat] ?? 'RealFin' });
  n++;
}
console.log(`generated default + ${n} post images in ${OUT}/`);
