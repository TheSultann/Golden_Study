import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2', 'chartjs-plugin-datalabels'],
          icons: ['react-icons'],
        },
      },
    },
  },
  // --- ДОБАВЛЯЕМ ЭТОТ БЛОК ---
  server: {
    proxy: {
      // Все запросы, начинающиеся с /api, будут перенаправлены
      // на ваш бэкенд-сервер
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:5001',
        changeOrigin: true,
      },
    }
  }
})
