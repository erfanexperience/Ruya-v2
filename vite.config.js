import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Ruya/',
  build: {
    chunkSizeWarningLimit: 2200, // spline runtime + three.js are large by nature
  },
})
