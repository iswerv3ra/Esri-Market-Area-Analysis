import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    
    define: {
      'process.env': env,
    },

    server: {
      port: 5173,
      host: true,
      cors: true,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/choreo-apis': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          secure: false
        }
      }
    },

    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('@arcgis/core')) {
              return 'arcgis';
            }
          }
        }
      }
    },

    optimizeDeps: {
      exclude: ['@arcgis/core']
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    }
  };
});