import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));

const apiPort = Number(process.env.SPORTMAKER_API_PORT || process.env.VITE_API_PORT || 3001);
const apiTarget = `http://127.0.0.1:${apiPort}`;
const vitePort = Number(process.env.VITE_DEV_PORT || process.env.PORT || 5173);

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        studio: path.resolve(root, 'studio.html'),
      },
    },
  },
  server: {
    host: true,
    port: vitePort,
    strictPort: Boolean(process.env.VITE_STRICT_PORT),
    // VITE_DISABLE_HMR=1 — no live reload while studying; refresh manually when ready (npm run dev:study).
    hmr: process.env.VITE_DISABLE_HMR === '1' ? false : undefined,
    proxy: {
      '/api': apiTarget,
      '/user-data': apiTarget,
      '/case-portraits': apiTarget,
      '/case-story-images': apiTarget,
    },
  },
});
