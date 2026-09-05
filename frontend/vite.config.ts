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
  // Security boundary — do not widen either of these.
  // envDir keeps env loading inside `frontend/`, so the repo-root .env (live
  // OPENAI/ANTHROPIC/RESEND keys, VAPID private key, JWT secrets, DATABASE_URL)
  // is never read into the browser bundle. envPrefix is the second barrier:
  // only VITE_* reaches client code, and every VITE_* value is public.
  // Both restate Vite's defaults — pinned so a future config change has to be
  // deliberate rather than silently loading root secrets into the build.
  envDir: __dirname,
  envPrefix: 'VITE_',
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
