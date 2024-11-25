// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
  },
  optimizeDeps: {
    exclude: ['@arcgis/core'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          arcgis: ['@arcgis/core'],
        },
      },
    },
  },
});
