import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    fs: {
      allow: [projectRoot],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
