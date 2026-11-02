import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite-plus';

const env = loadEnv(
  process.env.NODE_ENV || 'development',
  fileURLToPath(new URL('../../', import.meta.url)),
  ['PUBLIC_API_BASE_URL', 'DEV_API_PROXY_TARGET', 'APP_BASE_URL'],
);

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.PUBLIC_API_BASE_URL': JSON.stringify(env.PUBLIC_API_BASE_URL || '/api'),
      'import.meta.env.PUBLIC_APP_BASE_URL': JSON.stringify(env.APP_BASE_URL || ''),
    },
    server: {
      proxy: {
        '/api': env.DEV_API_PROXY_TARGET || 'http://127.0.0.1:8080',
      },
    },
  },
});
