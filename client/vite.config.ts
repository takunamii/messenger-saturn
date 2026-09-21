import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://chatapi-production-31cb.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader(
                'Access-Control-Allow-Methods',
                'GET, POST, PUT, DELETE, PATCH, OPTIONS'
            );
            proxyReq.setHeader(
                'Access-Control-Allow-Headers',
                'X-Requested-With, Content-Type, Authorization'
            );
            proxyReq.setHeader('Access-Control-Allow-Credentials', 'true');
          });
        }
      }
    }
  }
});