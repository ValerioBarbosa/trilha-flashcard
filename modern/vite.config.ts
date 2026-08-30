import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const modernSource = fileURLToPath(new URL('./src', import.meta.url));
const coreSource = fileURLToPath(new URL('../src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': modernSource,
      '@core': coreSource,
    },
  },
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
