import { defineConfig } from 'vite';

// Frontend paired with the ASP.NET Core backend (backend-dotnet, port 3000).
// JSX is handled by Vite's built-in esbuild transform.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  optimizeDeps: { esbuildOptions: { jsx: 'automatic' } },
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/hubs': { target: 'http://localhost:3001', ws: true, changeOrigin: true },
    },
  },
});
