import { defineConfig } from 'vite';

// JSX is handled by Vite's built-in esbuild transform (automatic runtime),
// so no extra plugin is required.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  optimizeDeps: { esbuildOptions: { jsx: 'automatic' } },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
      '/hubs': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
});
