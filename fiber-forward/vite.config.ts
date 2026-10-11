import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import mkcert from 'vite-plugin-mkcert'
import { defineConfig, type Plugin } from 'vite'

// Vite's dev static server doesn't know the .pem/.crt MIME type, but iOS
// needs application/x-x509-ca-cert specifically to offer to install it as a
// trusted profile instead of just showing raw text — this is temporary, for
// getting the local mkcert root CA onto a phone during dev HTTPS setup.
function rootCaMimeType(): Plugin {
  return {
    name: 'root-ca-mime-type',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/rootCA.pem' || req.url === '/rootCA.crt') {
          res.setHeader('Content-Type', 'application/x-x509-ca-cert')
        }
        if (req.url === '/rootCA.mobileconfig') {
          res.setHeader('Content-Type', 'application/x-apple-aspen-config')
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    // Generates a locally-trusted HTTPS cert for dev — camera (barcode
    // scanning) and microphone (voice features) both require a secure
    // context, which plain http://<lan-ip> doesn't satisfy. First run
    // installs a local CA (may prompt for admin rights once); the CA then
    // needs to be trusted on each test device too, e.g. a phone.
    mkcert(),
    rootCaMimeType(),
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
