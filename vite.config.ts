import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// GitHub Pages serves project sites from /<repo>/ ; local dev runs at /
const REPO_BASE = process.env.VITE_BASE ?? '/rutline/'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? REPO_BASE : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'brand/*.jpg'],
      manifest: {
        name: 'Rutline',
        short_name: 'Rutline',
        description: 'Map. Predict. Track. Stand map, live wind and weather, HuntCast movement forecast and a blood-trail camera for whitetail season.',
        theme_color: '#0f1110',
        background_color: '#0f1110',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,jpg,svg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Weather: prefer fresh, fall back to the last pull when there is no signal in the woods
            urlPattern: ({ url }) => url.hostname === 'api.open-meteo.com',
            handler: 'NetworkFirst',
            options: { cacheName: 'weather', networkTimeoutSeconds: 8, expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 12 } },
          },
          {
            // Map tiles: keep what you have looked at so your property still renders offline
            urlPattern: ({ url }) =>
              url.hostname.endsWith('arcgisonline.com') ||
              url.hostname.endsWith('nationalmap.gov') ||
              url.hostname.endsWith('openstreetmap.org'),
            handler: 'CacheFirst',
            options: { cacheName: 'tiles', expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 60 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('bigdatacloud.net') || url.hostname === 'geocoding-api.open-meteo.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'geo', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 5173, strictPort: true, host: true },
}))
