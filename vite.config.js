import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Repo Pages URL: https://malavikhasudarshan.github.io/yom/
  base: '/yom/',
})
