import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    
    // Environment configuration
    define: {
      'process.env': env,
    },

    // Server configuration for development
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
        }
      }
    },

    // Build configuration
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

    // Dependency optimization
    optimizeDeps: {
      exclude: ['@arcgis/core']
    },

    // Resolve configuration
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    }
  };
});