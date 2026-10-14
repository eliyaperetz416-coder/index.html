import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: true },
  preview: { host: true },
  build: { chunkSizeWarningLimit: 800 }, // three.js alone is ~600 KB
  // Changes every build so cached GLBs (same file names) are fetched again after an update.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
});
