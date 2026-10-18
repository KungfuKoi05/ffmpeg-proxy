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

// Rewrites the finished scripts so every non-ASCII character is a \uXXXX escape. Inside
// strings, regular expressions and comments the escape means exactly the same character, so
// behaviour is unchanged; the scripts then read the same whatever text encoding a host serves
// them with, and hosts that refuse files containing characters like U+FFFD accept them.
// The two places where an escape would NOT be equivalent (right after a backslash, or inside
// String.raw) make the build fail instead of producing a changed script.
function asciiOnly(): Plugin {
  return {
    name: 'cleancsv-ascii-only',
    apply: 'build',
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk' || !/[^\x00-\x7f]/.test(file.code)) continue
        if (/\\[^\x00-\x7f]/.test(file.code) || /String\.raw`[^`]*[^\x00-\x7f]/.test(file.code)) {
          this.error(`${file.fileName}: cannot safely escape a non-ASCII character here`)
        }
        file.code = file.code.replace(/[^\x00-\x7f]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)
      }
    },
  }
}

export default defineConfig({
  // Relative asset paths so the build works at a domain root (Cloudflare Pages)
  // and under a sub-path (GitHub Pages project sites).
  base: './',
  plugins: [react(), tailwindcss(), contentSecurityPolicy(), asciiOnly()],
  worker: { format: 'es', plugins: () => [asciiOnly()] },
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
