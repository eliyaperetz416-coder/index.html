import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: true },
  preview: { host: true },
  build: { chunkSizeWarningLimit: 800 }, // three.js alone is ~600 KB
});
