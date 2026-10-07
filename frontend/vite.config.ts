/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// The browser always calls /api/* on its own origin. In production a Vercel
// rewrite forwards it to Django (vercel.json); locally the dev server proxies it.
const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'fonts/*.woff2'],
      manifest: {
        name: 'EdgeProof',
        short_name: 'EdgeProof',
        description: 'Learn forex, build your own strategy and test it on data you have not seen.',
        theme_color: '#0E1A24',
        background_color: '#EEF1F2',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Published lessons are static JSON; cache them so learning works offline
        // and while the backend is asleep (spec §13, DESIGN.md §10).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/lessons/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'lessons' },
          },
        ],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
