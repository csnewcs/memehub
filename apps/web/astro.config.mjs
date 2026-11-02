import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite-plus';

const env = loadEnv(
  process.env.NODE_ENV || 'development',
  fileURLToPath(new URL('../../', import.meta.url)),
  ['PUBLIC_API_BASE_URL', 'DEV_API_PROXY_TARGET'],
);

export default defineConfig({
  vite: {
    define: {
      'import.meta.env.PUBLIC_API_BASE_URL': JSON.stringify(env.PUBLIC_API_BASE_URL || '/api'),
    },
    server: {
      proxy: {
        '/api': env.DEV_API_PROXY_TARGET || 'http://127.0.0.1:8080',
      },
    },
  },
});
