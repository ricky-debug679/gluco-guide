import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import mkcert from 'vite-plugin-mkcert'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    // Dev-only HTTPS: the service worker (installable PWA) needs a secure
    // context when a phone opens the dev server over the LAN or the tunnel.
    mkcert(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'GlucoGuide',
        short_name: 'GlucoGuide',
        description: 'AI-powered guidance that reads your food and groceries to help reverse prediabetes.',
        theme_color: '#5E8261',
        background_color: '#FBF7F1',
        display: 'standalone',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
