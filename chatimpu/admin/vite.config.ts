import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// The CMS shares domain types + sample data with the mobile app (../app/src/data).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@data': fileURLToPath(new URL('../app/src/data', import.meta.url)) } },
  server: { fs: { allow: ['..'] } },
})
