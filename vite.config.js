import { defineConfig } from 'vite';

export default defineConfig({
  base: '/angel/',
  build: {
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
