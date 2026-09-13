import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'production-security-policy',
      apply: 'build',
      transformIndexHtml(html) {
        return html.replace(
          "connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*;",
          "connect-src 'self';",
        );
      },
    },
  ],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
