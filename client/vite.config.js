import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Puertos propios (5180/3011): 5173/3001 son de portfolio-web-app y los dos corren a la vez.
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3011',
      '/ws': { target: 'ws://localhost:3011', ws: true },
    },
  },
});
