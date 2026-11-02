import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // In dev, the API runs on :3000; proxy keeps everything same-origin (cookies just work).
    proxy: { '/api': 'http://localhost:3000' },
  },
});
