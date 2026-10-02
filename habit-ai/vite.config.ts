import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globIgnores: ['mediapipe/**'], // big on-device model/wasm: cached on first posture scan instead
        runtimeCaching: [{ urlPattern: /\/mediapipe\//, handler: 'CacheFirst', options: { cacheName: 'mediapipe' } }],
      },
      manifest: {
        name: 'Habit AI', short_name: 'Habit AI', display: 'standalone',
        background_color: '#0b0d12', theme_color: '#0b0d12', start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
