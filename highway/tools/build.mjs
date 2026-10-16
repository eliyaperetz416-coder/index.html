// Build step (no bundler needed). Run after changing GAME_NAME or adding/removing files:
//   node tools/build.mjs
// - writes manifest.webmanifest + page title from GAME_NAME (src/config.js)
// - regenerates icons + iOS splash screens (needs python3 + Pillow) with --art
// - regenerates sw.js with the full offline file list and a content hash version
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { GAME_NAME, GAME_TAGLINE } = await import(pathToFileURL(path.join(root, 'src/config.js')).href);

// ---- images ----
const SPLASH = [[1320, 2868, 440, 956, 3], [1206, 2622, 402, 874, 3], [1290, 2796, 430, 932, 3], [1179, 2556, 393, 852, 3], [1284, 2778, 428, 926, 3],
  [1170, 2532, 390, 844, 3], [1125, 2436, 375, 812, 3], [1242, 2688, 414, 896, 3], [828, 1792, 414, 896, 2], [1242, 2208, 414, 736, 3], [750, 1334, 375, 667, 2]];
if (process.argv.includes('--art') || !fs.existsSync(path.join(root, 'icons/splash-1170x2532.png'))) {
  execFileSync('python3', [path.join(root, 'tools/make-icons.py'), GAME_NAME], { cwd: root, stdio: 'inherit' });
}

// ---- manifest ----
const manifest = {
  name: GAME_NAME, short_name: GAME_NAME.length > 12 ? GAME_NAME.slice(0, 12) : GAME_NAME, description: GAME_TAGLINE,
  id: './', start_url: './index.html', scope: './', display: 'standalone', orientation: 'any', background_color: '#06030f', theme_color: '#06030f', categories: ['games'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(root, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

// ---- index.html name + splash links ----
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<title>.*?<\/title>/, `<title>${GAME_NAME}</title>`)
  .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/, `$1${GAME_NAME}$2`);
const links = SPLASH.map(([w, h, dw, dh, r]) => `<link rel="apple-touch-startup-image" media="(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="icons/splash-${w}x${h}.png">`).join('\n');
html = html.replace(/<!-- splash:start -->[\s\S]*<!-- splash:end -->/, `<!-- splash:start -->\n${links}\n<!-- splash:end -->`);
fs.writeFileSync(path.join(root, 'index.html'), html);

// ---- service worker ----
const skip = new Set(['tools', 'node_modules', '.git']);
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (skip.has(f)) continue;
    const full = path.join(dir, f), rel = path.relative(root, full).split(path.sep).join('/');
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (!['sw.js', 'README.md'].includes(rel) && !rel.startsWith('icons/splash-')) files.push(rel);
  }
})(root);
files.sort();
const hash = crypto.createHash('sha1');
for (const f of files) { hash.update(f); hash.update(fs.readFileSync(path.join(root, f))); }
const version = hash.digest('hex').slice(0, 10);
const list = ['./', ...files.map((f) => './' + f)];
const tpl = fs.readFileSync(path.join(root, 'tools/sw.template.js'), 'utf8');
fs.writeFileSync(path.join(root, 'sw.js'), tpl.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(list, null, 1)));
console.log(`built "${GAME_NAME}" - ${files.length} files precached, version ${version}`);
