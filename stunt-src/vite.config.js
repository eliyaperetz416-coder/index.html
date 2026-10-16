import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GAME_NAME, GAME_TAGLINE, THEME_COLOR, BACKGROUND_COLOR, CACHE_PREFIX } from './src/config/game.js';

const BUILD_ID = Date.now().toString(36);

const manifest = () => ({
  name: GAME_NAME,
  short_name: GAME_NAME,
  description: GAME_TAGLINE,
  start_url: './',
  scope: './',
  display: 'fullscreen',
  orientation: 'portrait',
  background_color: BACKGROUND_COLOR,
  theme_color: THEME_COLOR,
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
});

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/**
 * PWA plugin: fills the game name into index.html, writes manifest.webmanifest from the config,
 * and writes sw.js with the list of every built file so the game works offline.
 */
function pwa() {
  let config;
  return {
    name: 'stunt-pwa',
    configResolved(c) {
      config = c;
    },
    transformIndexHtml(html) {
      return html.replaceAll('%GAME_NAME%', GAME_NAME).replaceAll('%THEME_COLOR%', THEME_COLOR);
    },
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(JSON.stringify(manifest(), null, 2));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(manifest(), null, 2) });
    },
    writeBundle(options, bundle) {
      const files = new Set(Object.keys(bundle));
      if (config.publicDir) for (const f of walk(config.publicDir)) files.add(relative(config.publicDir, f).split('\\').join('/'));
      files.delete('sw.js');
      const list = ['./', ...[...files].sort().map((f) => `./${f}`)];
      const sw = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8')
        .replace('self.__PRECACHE__', JSON.stringify(list))
        .replace('__CACHE_PREFIX__', CACHE_PREFIX)
        .replace('__BUILD_ID__', BUILD_ID);
      writeFileSync(join(options.dir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  base: './',
  server: { host: true },
  preview: { host: true },
  build: { chunkSizeWarningLimit: 900, assetsInlineLimit: 0 },
  plugins: [pwa()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
});
