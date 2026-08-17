import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxy = {
  '/api': {
    target: 'https://www.youryom.com',
    changeOrigin: true,
    secure: true,
    timeout: 120000,
  },
}

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
})
