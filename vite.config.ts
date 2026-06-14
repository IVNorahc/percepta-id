import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' surfaces a "new version available" indicator the user can act
      // on, instead of silently reloading. Registration + update checks are
      // handled by useRegisterSW() in src/components/PwaManager.tsx.
      registerType: 'prompt',
      // We register the SW ourselves via the React hook, so don't inject the
      // plugin's own registration script (that would register it twice).
      injectRegister: false,
      // We ship a hand-written public/manifest.json and link it in index.html,
      // so the plugin must not generate or inject its own manifest.
      manifest: false,
      // Static assets to precache in addition to the build output.
      includeAssets: [
        'favicon.svg',
        'icon-192x192.png',
        'icon-512x512.png',
        'apple-touch-icon.png',
      ],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // SPA fallback so deep links work offline.
        navigateFallback: '/index.html',
        // Don't precache the manifest itself; it's served directly.
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Keep the SW disabled in `vite dev` to avoid caching surprises.
        enabled: false,
      },
    }),
  ],
})
