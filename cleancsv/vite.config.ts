/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Strict Content-Security-Policy for the production build only. The dev server needs
// inline scripts and a websocket for hot reload, so it is left out there.
// connect-src 'self' means the page cannot send data to any other server.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'cleancsv-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
  }
}

export default defineConfig({
  // Relative asset paths so the build works at a domain root (Cloudflare Pages)
  // and under a sub-path (GitHub Pages project sites).
  base: './',
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  worker: { format: 'es' },
  build: {
    // The main bundle is ~175 KB gzipped: mostly React and Google's phone-number rules
    // (libphonenumber-js). That is acceptable for a tool page, so the default 500 KB warning is raised.
    chunkSizeWarningLimit: 650,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/**/*.perf.test.ts'],
  },
})
