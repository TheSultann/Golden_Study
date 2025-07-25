import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // --- ДОБАВЛЯЕМ ЭТОТ БЛОК ---
  server: {
    proxy: {
      // Все запросы, начинающиеся с /api, будут перенаправлены
      // на ваш бэкенд-сервер
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    }
  }
})