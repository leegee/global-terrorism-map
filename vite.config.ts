import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import Pages from 'vite-plugin-pages';

export default defineConfig({
  plugins: [
    Pages({
      dirs: ['src/pages'],
    }),
    solidPlugin(),
  ],

  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
  },

  server: {
    port: 3000,
  },
});
