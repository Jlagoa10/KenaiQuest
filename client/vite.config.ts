import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // The API base URL is read from the repository root .env so a single file
  // configures both workspaces during development.
  const env = loadEnv(mode, path.resolve(process.cwd(), '..'), 'VITE_');

  return {
    plugins: [react(), tailwindcss()],
    envDir: path.resolve(process.cwd(), '..'),
    resolve: {
      alias: { '@': path.resolve(process.cwd(), 'src') },
    },
    server: {
      port: 5173,
      // Lets the browser call the API same-origin in development, so cookie
      // behaviour matches production without any CORS special-casing.
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
          },
        },
      },
    },
  };
});
