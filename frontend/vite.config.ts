import path from 'path';
import { execSync } from 'child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const gitSha = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'dev'; }
})();

// See https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src/service-worker',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: false,
      devOptions: {
        enabled: process.env['VITE_SW_DEV'] === 'true',
        type: 'module',
      },
    }),
  ],
  define: {
    __BUILD_INFO__: JSON.stringify({
      gitSha: process.env['VITE_GIT_SHA'] ?? gitSha,
      buildTime: new Date().toISOString(),
      env: process.env['NODE_ENV'] ?? 'development',
    }),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    define: {
      __BUILD_INFO__: JSON.stringify({
        gitSha: 'test-sha',
        buildTime: new Date().toISOString(),
        env: 'test',
      }),
    },
  },
});
