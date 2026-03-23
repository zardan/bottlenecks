import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  server: {
    proxy: {
      '/entsoe-api': {
        target: 'https://web-api.tp.entsoe.eu',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/entsoe-api/, ''),
      },
      '/scb-api': {
        target: 'https://statistikdatabasen.scb.se',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/scb-api/, ''),
      },
    },
  },
})
