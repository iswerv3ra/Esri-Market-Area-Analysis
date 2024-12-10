import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

// Plugin to copy oauth-callback.html to dist during build
const copyOAuthCallback = () => ({
  name: 'copy-oauth-callback',
  closeBundle: () => {
    const srcPath = path.resolve(__dirname, 'public/oauth-callback.html');
    const destPath = path.resolve(__dirname, 'dist/oauth-callback.html');
    
    // Ensure dist directory exists
    if (!existsSync(path.dirname(destPath))) {
      mkdirSync(path.dirname(destPath), { recursive: true });
    }
    
    copyFileSync(srcPath, destPath);
    console.log('Copied oauth-callback.html to dist folder');
  }
});

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      copyOAuthCallback()
    ],
    
    define: {
      'process.env': env
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
          manualChunks: {
            // Separate chunk for ArcGIS core
            arcgis: ['@arcgis/core'],
            // Separate chunk for authentication related modules
            auth: [
              '@arcgis/core/identity/IdentityManager',
              '@arcgis/core/identity/OAuthInfo'
            ],
            // Vendor chunk for other large dependencies
            vendor: [
              'react',
              'react-dom',
              'react-router-dom'
            ]
          }
        }
      }
    },

    optimizeDeps: {
      exclude: ['@arcgis/core'],
      include: [
        // Pre-bundle these common dependencies
        'react',
        'react-dom',
        'react-router-dom'
      ]
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    }
  };
});